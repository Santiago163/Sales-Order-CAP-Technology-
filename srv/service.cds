using {salesorders as so} from '../db/schema';
using {sap.common as cu} from '@sap/cds/common';

@(path: '/salesorders')
service SalesOrdersService {

    // Draft: la edición trabaja sobre tablas de borrador y se confirma
    // con la acción bound draftActivate (≈ "with draft" en RAP).
    // Items hereda el draft automáticamente por la composición.
    @odata.draft.enabled
    entity Headers as projection on so.Headers;

    entity Items   as projection on so.Items;

    @readonly
    entity OrderStatuses as projection on so.OrderStatuses;

    @readonly
    entity Currencies as projection on cu.Currencies;
}