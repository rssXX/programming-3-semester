export enum Systems {
    ERP = 'ERP', // Enterprise Resource Planning
    CRM = 'CRM', // Customer Relationship Management
    WMS = 'WMS', // Warehouse Management System
}

export enum Codes {
    SUCCESS = 'success',
    FAILED = 'failed',
}

export enum ErrorMessages {
    EMPTY = '',
    VALIDATION = 'Ошибка валидации',
    UNSUPPORTED = 'Не поддерживаемая ошибка',
    UNKNOWN = 'Произошла непредвиденная ошибка',
}

export enum ErrorCodes {
    EMPTY = '',
    VALIDATION_EXCEPTION = 'ValidationException',
    UNKNOWN_EXCEPTION = 'UnknownException',
    UNSUPPORTED_EXCEPTION = 'UnsupportedCodeException',
}
