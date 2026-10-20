using {salesorders as so} from '../db/schema'; 
using {sap.common as cu} from '@sap/cds/common';

@(path: '/salesorders')
service SalesOrdersService {

    entity Headers as projection on so.Headers;
    entity Items   as projection on so.Items;

    @readonly
    entity OrderStatuses as projection on so.OrderStatuses;

    @readonly
    entity Currencies as projection on cu.Currencies;
}

// Concurrencia optimista (equivalente a local_last_changed_at en RAP)
annotate SalesOrdersService.Headers with @odata.etag: modifiedAt;
annotate SalesOrdersService.Items with @odata.etag: modifiedAt;