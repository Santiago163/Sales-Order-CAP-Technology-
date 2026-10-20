namespace salesorders;

using {
    managed,
    sap.common.Currencies
} from '@sap/cds/common';

/**
 * Sales Orders - Header
 */
entity Headers : managed {
    key ID           : String(36)                    @title: '{i18n>ID}';
    key Email        : String(30)                    @title: '{i18n>Email}'  @mandatory;
        FirstName    : String(30)                    @title: '{i18n>FirstName}';
        LastName     : String(30)                    @title: '{i18n>LastName}';
        Country      : String(30)                    @title: '{i18n>Country}';
        CreateOn     : Date                          @title: '{i18n>CreateOn}';
        DeliveryDate : DateTime                      @title: '{i18n>DeliveryDate}';
        OrderStatus  : Integer                       @title: '{i18n>OrderStatus}';
        ImageURL     : String                        @title: '{i18n>ImageURL}';
        Items        : Composition of many Items
                           on Items.Header = $self;
}

/**
 * Sales Orders - Items
 */
entity Items : managed {
    key ItemUUID         : UUID                      @title: '{i18n>ItemUUID}';
        Header           : Association to Headers    @title: '{i18n>OrderID}';
        Name             : String(40)                @title: '{i18n>Name}';
        Description      : String(40)                @title: '{i18n>Description}';
        ReleaseDate      : Date                      @title: '{i18n>ReleaseDate}';
        DiscontinuedDate : Date                      @title: '{i18n>DiscontinuedDate}';
        Price            : Decimal(12, 2)            @title: '{i18n>Price}';
        Currency         : Association to Currencies @title: '{i18n>Currency}';
        Height           : Decimal(15, 3)            @title: '{i18n>Height}';
        Width            : Decimal(13, 3)            @title: '{i18n>Width}';
        Depth            : Decimal(12, 2)            @title: '{i18n>Depth}';
        Quantity         : Decimal(16, 2)            @title: '{i18n>Quantity}';
        UnitOfMeasure    : String(3)                 @title: '{i18n>UnitOfMeasure}';
}

/**
 * Value Help: Order Status (equivalente al dominio zde_status_2699)
 */
entity OrderStatuses {
    key code        : Integer            @title: '{i18n>StatusCode}';
        text        : localized String(60) @title: '{i18n>StatusText}';
        criticality : Integer            @title: '{i18n>Criticality}';
}

