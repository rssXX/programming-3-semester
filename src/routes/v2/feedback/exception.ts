export class ValidationFailedException extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ValidationFailedException'
    }
}

export class UnsupportedCodeException extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'UnsupportedCodeException'
    }
}
