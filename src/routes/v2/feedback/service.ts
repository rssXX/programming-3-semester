import { ValidationFailedException } from './exception'
import { consola } from 'consola'
import { DateTimeUtil } from '../../../util/DateTimeUtil'
import type { FeedbackModelResponse } from './model'

type FeedbackResponse = typeof FeedbackModelResponse.static

export interface ValidationService {
    isValid(errors: readonly string[]): void
}

export class RequestValidationService implements ValidationService {
    constructor(private readonly logger = consola) {}

    isValid(errors: readonly string[]): void {
        this.logger.info('Request validation started')
        if (errors.length > 0) {
            this.logger.error('ValidationFailedException:', errors)
            throw new ValidationFailedException(errors[0])
        }
        this.logger.info('Request validation passed')
    }
}

export interface ModifyResponseService {
    modify(response: FeedbackResponse): FeedbackResponse
}

export class ModifyOperationUidResponseService implements ModifyResponseService {
    modify(response: FeedbackResponse): FeedbackResponse {
        consola.info('Before operationUid modification:', JSON.stringify(response))
        response.operationUid = crypto.randomUUID()
        consola.info('After operationUid modification:', JSON.stringify(response))
        return response
    }
}

export class ModifySystemTimeResponseService implements ModifyResponseService {
    constructor(private readonly logger = consola) {}

    modify(response: FeedbackResponse): FeedbackResponse {
        this.logger.info('Before systemTime modification:', JSON.stringify(response))
        response.systemTime = DateTimeUtil.getCustomFormat(new Date())
        this.logger.info('After systemTime modification:', JSON.stringify(response))
        return response
    }
}
