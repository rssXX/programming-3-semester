import { ValidationFailedException } from './exception'
import { consola } from 'consola'
import { DateTimeUtil } from '../../../util/DateTimeUtil'
import type { FeedbackModelResponse } from './model'

type FeedbackResponse = typeof FeedbackModelResponse.static

export interface ValidationService {
    isValid(errors: readonly string[]): void
}

export class RequestValidationService implements ValidationService {
    isValid(errors: readonly string[]): void {
        consola.info('Request validation started')
        if (errors.length > 0) {
            consola.error('ValidationFailedException:', errors)
            throw new ValidationFailedException(errors[0])
        }
        consola.info('Request validation passed')
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
    modify(response: FeedbackResponse): FeedbackResponse {
        consola.info('Before systemTime modification:', JSON.stringify(response))
        response.systemTime = DateTimeUtil.getCustomFormat(new Date())
        consola.info('After systemTime modification:', JSON.stringify(response))
        return response
    }
}
