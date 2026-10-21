const cds = require('@sap/cds');
const { INSERT, UPDATE, DELETE, SELECT } = cds.ql;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mensajes EN/ES según idioma del usuario (sap-language / Accept-Language) */
const msg = (req, en, es) =>
    String(req.locale || '').toLowerCase().startsWith('es') ? es : en;

class SalesOrdersService extends cds.ApplicationService {

    async init() {
        const { Headers, Items } = this.entities;

        /* ==================== VALIDACIONES (req. 4.1) ==================== */

        const validateHeader = (req) => {
            const { ID, Email, CreateOn, DeliveryDate } = req.data;

            if (req.event === 'CREATE') {
                if (!ID)    return req.reject(400, msg(req, 'ID is required.', 'El ID es obligatorio.'));
                if (!Email) return req.reject(400, msg(req, 'Email is required.', 'El Email es obligatorio.'));
            }
            if (Email !== undefined && !EMAIL_REGEX.test(Email)) {
                return req.reject(400, msg(req, `Invalid e-mail format: ${Email}.`, `Formato de email no válido: ${Email}.`));
            }
            if (CreateOn && DeliveryDate && new Date(DeliveryDate) < new Date(CreateOn)) {
                return req.reject(400, msg(req,
                    'Delivery Date cannot be before Created On.',
                    'La fecha de entrega no puede ser anterior a la de creación.'));
            }
        };

        const validateItem = async (req) => {
            if (req.event === 'CREATE') {
                req.data.ItemUUID ??= cds.utils.uuid();

                const { Header_ID } = req.data;
                if (!Header_ID) {
                    return req.reject(400, msg(req, 'Order ID is required.', 'El ID de la orden es obligatorio.'));
                }
                const header = await SELECT.one.from(Headers).where({ ID: Header_ID });
                if (!header) {
                    return req.reject(400, msg(req, `Sales order ${Header_ID} does not exist.`, `La orden ${Header_ID} no existe.`));
                }
            }
        };

        this.before('CREATE', Headers, validateHeader);
        this.before('UPDATE', Headers, validateHeader);
        this.before(['CREATE', 'UPDATE'], Items, validateItem);

        /* ============ CRUD – SERVICIOS CUD DE JAVASCRIPT (CQL) ============ */

        // ALTA (2.1) – con deep insert de ítems
        this.on('CREATE', Headers, async (req) => {
            const tx = cds.tx(req);
            const exists = await tx.run(SELECT.one.from(Headers).where({ ID: req.data.ID }));
            if (exists) {
                return req.reject(409, msg(req, `Sales order ${req.data.ID} already exists.`, `La orden ${req.data.ID} ya existe.`));
            }
            req.data.CreateOn ??= new Date();
            await tx.run(INSERT.into(Headers).entries(req.data));
            return tx.run(SELECT.one.from(Headers).where({ ID: req.data.ID }));
        });

        // REPORTE (2.4) – SELECT conserva $filter, $expand, paginación…
        this.on('READ', Headers, (req) => cds.tx(req).run(req.query));
        this.on('READ', Items, (req) => cds.tx(req).run(req.query));

        // MODIFICACIÓN (2.2)
        this.on('UPDATE', Headers, async (req) => {
            const tx = cds.tx(req);
            const { ID } = req.data;
            const current = await tx.run(SELECT.one.from(Headers).where({ ID }));
            if (!current) return req.reject(404, msg(req, `Sales order ${ID} not found.`, `Orden ${ID} no encontrada.`));

            await tx.run(UPDATE(Headers).set(req.data).where({ ID }));
            return tx.run(SELECT.one.from(Headers).where({ ID }));
        });

        // ELIMINACIÓN (2.3) – con borrado en cascada de ítems
        this.on('DELETE', Headers, async (req) => {
            const tx = cds.tx(req);
            const { ID } = req.data;
            const affected = await tx.run(DELETE.from(Headers).where({ ID }));
            if (!affected) return req.reject(404, msg(req, `Sales order ${ID} not found.`, `Orden ${ID} no encontrada.`));

            await tx.run(DELETE.from(Items).where({ Header_ID: ID }));
        });

        // CRUD de ítems
        this.on('CREATE', Items, async (req) => {
            const tx = cds.tx(req);
            await tx.run(INSERT.into(Items).entries(req.data));
            return tx.run(SELECT.one.from(Items).where({ ItemUUID: req.data.ItemUUID }));
        });

        this.on('UPDATE', Items, async (req) => {
            const tx = cds.tx(req);
            const { ItemUUID } = req.data;
            const current = await tx.run(SELECT.one.from(Items).where({ ItemUUID }));
            if (!current) return req.reject(404, msg(req, `Item ${ItemUUID} not found.`, `Ítem ${ItemUUID} no encontrado.`));

            await tx.run(UPDATE(Items).set(req.data).where({ ItemUUID }));
            return tx.run(SELECT.one.from(Items).where({ ItemUUID }));
        });

        this.on('DELETE', Items, async (req) => {
            const affected = await cds.tx(req).run(
                DELETE.from(Items).where({ ItemUUID: req.data.ItemUUID })
            );
            if (!affected) return req.reject(404, msg(req, 'Item not found.', 'Ítem no encontrado.'));
        });

        return super.init();
    }
}

module.exports = SalesOrdersService;