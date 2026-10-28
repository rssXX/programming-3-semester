// ЛР5: прикладной сервис объединяет расчёт, пересылку ЛР4 и формирование ответа.
import { consola } from 'consola'
import { UnsupportedCodeException } from '../../v2/feedback/exception'
import { FeedbackResponseService } from '../../v2/feedback/response-service'
import type { ForwardRequestService } from '../../v3/feedback/service'
import { AnnualBonusServiceImpl, QuarterlyBonusServiceImpl } from './bonus'
import type { AnnualBonusService, QuarterlyBonusService } from './bonus'
import { POSITION_DETAILS } from './enums'
import type { BonusRequest, BonusResponse } from './model'

export class BonusFeedbackService {
    readonly responses: FeedbackResponseService

    constructor(
        private readonly forwardingService: Pick<ForwardRequestService, 'forward'>,
        private readonly logger = consola.withTag('Service 1 / LR5'),
        private readonly annualBonusService: AnnualBonusService = new AnnualBonusServiceImpl(),
        private readonly quarterlyBonusService: QuarterlyBonusService = new QuarterlyBonusServiceImpl(annualBonusService),
    ) {
        this.responses = new FeedbackResponseService(logger)
    }

    async handle(body: BonusRequest, receivedAt: number): Promise<BonusResponse> {
        this.logger.info('request:', JSON.stringify(body))
        if (body.uid === '123') throw new UnsupportedCodeException('uid 123 не поддерживается')

        const year = body.year ?? new Date().getFullYear()
        const { position, salary, bonus, workDays } = body
        const annualBonus = this.annualBonusService.calculate(position, salary, bonus, workDays, year)
        const quarterlyBonus = POSITION_DETAILS[position].isManager
            ? this.quarterlyBonusService.calculate(position, salary, bonus, workDays, year)
            : null

        // Ошибочные данные отсекаются до сетевого запроса. Пересылка остаётся от ЛР4.
        await this.forwardingService.forward(body, receivedAt)
        const response = { ...this.responses.createSuccess(body), annualBonus, quarterlyBonus }
        this.logger.info('Response sent (200):', JSON.stringify(response))
        return response
    }
}
