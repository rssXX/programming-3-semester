import { ValidationFailedException } from './exception'

export interface ValidationService {
    isValid(errors: readonly string[]): void
}

export class RequestValidationService implements ValidationService {
    isValid(errors: readonly string[]): void {
        if (errors.length > 0) {
            throw new ValidationFailedException(errors[0])
        }
    }
}
