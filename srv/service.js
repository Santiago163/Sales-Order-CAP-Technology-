const cds = require('@sap/cds');
const { UPDATE, DELETE, SELECT } = cds.ql;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mensajes EN/ES según idioma del usuario (sap-language / Accept-Language) */
const msg = (req, en, es) =>
    String(req.locale || '').toLowerCase().startsWith('es') ? es : en;

class SalesOrdersService extends cds.ApplicationService {

    async init() {
        const { Headers, Items } = this.entities;

        // Entidades de borrador generadas por @odata.draft.enabled
        // (equivalentes a las draft tables zsoheader_d / zsoitems_d en RAP)
        const HeaderDrafts = Headers.drafts;   // SalesOrdersService.Headers.drafts
        const ItemDrafts   = Items.drafts;     // SalesOrdersService.Items.drafts

        /* ================================================================
         * 1. DEFAULTS + VALIDACIONES DE CAMPO SOBRE BORRADORES
         *    (feedback inmediato en Fiori Elements al editar)
         * ================================================================ */

        // Numeración tardía: FE publica un borrador vacío al pulsar Create,
        // así que el ID lo genera el servidor (sigue siendo CHAR(36) como en RAP).
        // '??=' lo hace idempotente: en draftEdit (copia de un activo) no pisa nada.
        this.before('CREATE', HeaderDrafts, (req) => {
            req.data.ID       ??= cds.utils.uuid();
            req.data.CreateOn ??= new Date();
        });

        const validateHeaderDraft = (req) => {
            const { Email, CreateOn, DeliveryDate } = req.data;

            if (Email && !EMAIL_REGEX.test(Email)) {
                return req.error({
                    code   : '400',
                    message: msg(req, `Invalid e-mail format: ${Email}.`,
                                      `Formato de email no válido: ${Email}.`),
                    target : 'Email'          // resalta el campo en FE
                });
            }
            if (CreateOn && DeliveryDate && new Date(DeliveryDate) < new Date(CreateOn)) {
                return req.error({
                    code   : '400',
                    message: msg(req, 'Delivery Date cannot be before Created On.',
                                      'La fecha de entrega no puede ser anterior a la de creación.'),
                    target : 'DeliveryDate'
                });
            }
        };
        this.before(['CREATE', 'UPDATE'], HeaderDrafts, validateHeaderDraft);

        // Alta de ítem en borrador: clave técnica + existencia de cabecera
        this.before('CREATE', ItemDrafts, async (req) => {
            req.data.ItemUUID ??= cds.utils.uuid();

            const tx = cds.tx(req);
            const { Header_ID } = req.data;
            if (!Header_ID) {
                return req.error({ code: '400', target: 'Header_ID',
                    message: msg(req, 'Order ID is required.', 'El ID de la orden es obligatorio.') });
            }
            // La cabecera puede ser aún un borrador (alta nueva) o estar activa
            const header =
                await tx.run(SELECT.one.from(HeaderDrafts).columns('ID').where({ ID: Header_ID }))
                ?? await tx.run(SELECT.one.from(Headers).columns('ID').where({ ID: Header_ID }));
            if (!header) {
                return req.error({ code: '400', target: 'Header_ID',
                    message: msg(req, `Sales order ${Header_ID} does not exist.`,
                                      `La orden ${Header_ID} no existe.`) });
            }
        });

        const validateItemDraft = (req) => {
            const { ReleaseDate, DiscontinuedDate, Price, Quantity } = req.data;

            if (ReleaseDate && DiscontinuedDate &&
                new Date(DiscontinuedDate) < new Date(ReleaseDate)) {
                return req.error({ code: '400', target: 'DiscontinuedDate',
                    message: msg(req, 'Discontinued Date cannot be before Release Date.',
                                      'La fecha de descatalogación no puede ser anterior a la de lanzamiento.') });
            }
            if (Price !== undefined && Price < 0) {
                return req.error({ code: '400', target: 'Price',
                    message: msg(req, 'Price cannot be negative.', 'El precio no puede ser negativo.') });
            }
            if (Quantity !== undefined && Quantity < 0) {
                return req.error({ code: '400', target: 'Quantity',
                    message: msg(req, 'Quantity cannot be negative.', 'La cantidad no puede ser negativa.') });
            }
        };
        this.before(['CREATE', 'UPDATE'], ItemDrafts, validateItemDraft);

        /* ================================================================
         * 2. CAMPOS OBLIGATORIOS (req. 4.1) → SE EXIGEN AL ACTIVAR (SAVE)
         *    Equivale a las validaciones "on save" del behavior RAP.
         * ================================================================ */

        this.before('draftActivate', Headers, async (req) => {
            const tx = cds.tx(req);
            // Acción bound: las claves llegan en req.data (fallback: req.params)
            const keys = req.data?.ID ? req.data : (req.params?.[0] ?? {});
            const { ID } = keys;

            const draft = await tx.run(SELECT.one.from(HeaderDrafts).where({ ID }));
            if (!draft) {
                return req.reject(404, msg(req, `Draft of sales order ${ID} not found.`,
                                                `Borrador de la orden ${ID} no encontrado.`));
            }

            // HEADER: Email obligatorio (req. 4.1). target 'in/<prop>' resalta
            // el campo en FE cuando el error se lanza desde una acción bound.
            if (!draft.Email) {
                return req.error({ code: '400', target: 'in/Email',
                    message: msg(req, 'Email is required.', 'El Email es obligatorio.') });
            }
            if (!EMAIL_REGEX.test(draft.Email)) {
                return req.error({ code: '400', target: 'in/Email',
                    message: msg(req, `Invalid e-mail format: ${draft.Email}.`,
                                      `Formato de email no válido: ${draft.Email}.`) });
            }

            // CreateOn garantizado en la activación (CUD explícito sobre el borrador)
            if (!draft.CreateOn) {
                await tx.run(UPDATE(HeaderDrafts).set({ CreateOn: new Date() }).where({ ID }));
            }
            const createOn = draft.CreateOn ?? new Date();
            if (draft.DeliveryDate && new Date(draft.DeliveryDate) < new Date(createOn)) {
                return req.error({ code: '400', target: 'in/DeliveryDate',
                    message: msg(req, 'Delivery Date cannot be before Created On.',
                                      'La fecha de entrega no puede ser anterior a la de creación.') });
            }
        });

        /* ================================================================
         * 3. ELIMINACIÓN (req. 2.3) — CUD EXPLÍCITO CON CASCADA
         *    Borrado de la orden ACTIVA + sus ítems + posibles borradores.
         *    (El borrado de borradores propios lo gestiona el runtime
         *     vía draftDiscard / DELETE sobre *.drafts.)
         * ================================================================ */

        this.on('DELETE', Headers, async (req) => {
            const tx = cds.tx(req);
            const { ID } = req.data;

            const affected = await tx.run(DELETE.from(Headers).where({ ID }));
            if (!affected) {
                return req.reject(404, msg(req, `Sales order ${ID} not found.`,
                                                `Orden ${ID} no encontrada.`));
            }
            await tx.run(DELETE.from(Items).where({ Header_ID: ID }));
            // Limpieza de borradores huérfanos asociados a la orden
            await tx.run(DELETE.from(ItemDrafts).where({ Header_ID: ID }));
            await tx.run(DELETE.from(HeaderDrafts).where({ ID }));
        });

        return super.init();
    }
}

module.exports = SalesOrdersService;