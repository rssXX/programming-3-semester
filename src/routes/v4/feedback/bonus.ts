// ЛР5: чистые сервисы расчёта премий; не зависят от HTTP, логгера или второго сервиса.
import { DateTimeUtil } from '../../../util/DateTimeUtil'
import { UnsupportedCodeException, ValidationFailedException } from '../../v2/feedback/exception'
import { POSITION_DETAILS, Positions } from './enums'

export interface AnnualBonusService {
    calculate(position: Positions, salary: number, bonus: number, workDays: number, year?: number): number
}

export class AnnualBonusServiceImpl implements AnnualBonusService {
    calculate(position: Positions, salary: number, bonus: number, workDays: number, year = new Date().getFullYear()): number {
        const details = POSITION_DETAILS[position]
        if (!details) throw new ValidationFailedException('Неизвестная должность')
        if (!Number.isFinite(salary) || salary < 0) throw new ValidationFailedException('Зарплата должна быть конечным неотрицательным числом')
        if (!Number.isFinite(bonus) || bonus < 0) throw new ValidationFailedException('Множитель премии должен быть конечным неотрицательным числом')
        const daysInYear = DateTimeUtil.getDaysInYear(year)
        if (!Number.isInteger(workDays) || workDays < 1 || workDays > daysInYear) {
            throw new ValidationFailedException(`Число отработанных дней должно быть от 1 до ${daysInYear}`)
        }

        // Формула рисунка 2: salary * bonus * дниВГоду * коэффициентДолжности / workDays.
        const result = salary * bonus * daysInYear * details.positionCoefficient / workDays
        if (!Number.isFinite(result)) throw new ValidationFailedException('Результат расчёта выходит за диапазон чисел')
        return result
    }
}

export interface QuarterlyBonusService {
    calculate(position: Positions, salary: number, bonus: number, workDays: number, year?: number): number
}

export class QuarterlyBonusServiceImpl implements QuarterlyBonusService {
    constructor(private readonly annualBonusService: AnnualBonusService = new AnnualBonusServiceImpl()) {}

    calculate(position: Positions, salary: number, bonus: number, workDays: number, year?: number): number {
        const details = POSITION_DETAILS[position]
        if (!details) throw new ValidationFailedException('Неизвестная должность')
        if (!details.isManager) throw new UnsupportedCodeException('Квартальная премия доступна только руководителям')

        // В методичке формула не задана: принят равномерный расчёт за 4 квартала года.
        return this.annualBonusService.calculate(position, salary, bonus, workDays, year) / 4
    }
}
