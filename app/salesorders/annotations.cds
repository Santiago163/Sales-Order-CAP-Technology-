using SalesOrdersService from '../../srv/service';

/* ============================ HEADERS ============================ */
annotate SalesOrdersService.Headers with @(
    UI.HeaderInfo        : {
        TypeName      : '{i18n>SalesOrder}',
        TypeNamePlural: '{i18n>SalesOrders}',
        Title         : {Value: ID},
        Description   : {Value: Email},
        ImageUrl      : ImageURL
    },
    UI.SelectionFields   : [ID, Email, Country, OrderStatus],
    UI.PresentationVariant: {
        SortOrder: [{
            Property  : CreateOn,
            Descending: true
        }]
    },
    UI.LineItem          : [
        {Value: ID},
        {Value: Email},
        {Value: FirstName},
        {Value: LastName},
        {Value: Country},
        {Value: CreateOn},
        {Value: DeliveryDate},
        {Value: OrderStatus}
    ],
    UI.Facets            : [
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'GeneralFacet',
            Label : '{i18n>GeneralInformation}',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'DatesFacet',
            Label : '{i18n>Dates}',
            Target: '@UI.FieldGroup#Dates'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'ItemsFacet',
            Label : '{i18n>Items}',
            Target: 'Items/@UI.LineItem'
        }
    ],
    UI.FieldGroup #General: {Data: [
        {Value: ID},
        {Value: Email},
        {Value: FirstName},
        {Value: LastName},
        {Value: Country},
        {Value: ImageURL}
    ]},
    UI.FieldGroup #Dates  : {Data: [
        {Value: CreateOn},
        {Value: DeliveryDate},
        {Value: OrderStatus}
    ]}
);

annotate SalesOrdersService.Headers with {
    ID       @Common.FieldControl: #ReadOnly; // numeración tardía en el servidor
    CreateOn    @Common.FieldControl: #ReadOnly; // la asigna el servidor
    OrderStatus @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList               : {
            Label         : '{i18n>OrderStatus}',
            CollectionPath: 'OrderStatuses',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: OrderStatus,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'text'
                }
            ]
        }
    );
};

annotate SalesOrdersService.OrderStatuses with {
    code @Common.Text: text  @Common.TextArrangement: #TextFirst;
};

/* ============================= ITEMS ============================= */
annotate SalesOrdersService.Items with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>Item}',
        TypeNamePlural: '{i18n>Items}',
        Title         : {Value: Name},
        Description   : {Value: Description}
    },
    UI.LineItem           : [
        {Value: Name},
        {Value: Description},
        {Value: ReleaseDate},
        {Value: Price},
        {Value: Quantity}
    ],
    UI.Facets             : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>Details}',
            Target: '@UI.FieldGroup#Details'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>Measures}',
            Target: '@UI.FieldGroup#Measures'
        }
    ],
    UI.FieldGroup #Details: {Data: [
        {Value: Name},
        {Value: Description},
        {Value: ReleaseDate},
        {Value: DiscontinuedDate},
        {Value: Price},
        {Value: Currency_code},
        {Value: Quantity},
        {Value: UnitOfMeasure}
    ]},
    UI.FieldGroup #Measures: {Data: [
        {Value: Height},
        {Value: Width},
        {Value: Depth},
        {Value: DimensionsUoM}
    ]}
);

annotate SalesOrdersService.Items with {
    Price    @Measures.ISOCurrency: Currency_code;
    Quantity @Measures.Unit       : UnitOfMeasure;
};