// ЛР5: unit-тесты расчётов без HTTP и запуска приложений.
import { describe, expect, test } from 'bun:test'
import { DateTimeUtil } from '../src/util/DateTimeUtil'
import { UnsupportedCodeException, ValidationFailedException } from '../src/routes/v2/feedback/exception'
import { AnnualBonusServiceImpl, QuarterlyBonusServiceImpl } from '../src/routes/v4/feedback/bonus'
import { Positions } from '../src/routes/v4/feedback/enums'

describe('ЛР5: календарный год', () => {
    test.each([[2023, 365], [2024, 366], [1900, 365], [2000, 366], [2100, 365], [2400, 366]])(
        '%i год содержит %i дней', (year, expected) => {
            expect(DateTimeUtil.getDaysInYear(year)).toBe(expected)
        },
    )
})

describe('ЛР5: AnnualBonusService', () => {
    const service = new AnnualBonusServiceImpl()

    test('пример из методички: HR, оклад 100000, множитель 2, 243 дня', () => {
        // given / when / then: фиксированный невисокосный год воспроизводит Java-пример.
        const result = service.calculate(Positions.HR, 100000, 2, 243, 2023)
        expect(result).toBeCloseTo(360493.8271604938, 8)
    })

    test('использует 366 дней в високосном году', () => {
        expect(service.calculate(Positions.HR, 100000, 2, 243, 2024)).toBeCloseTo(361481.48148148146, 8)
    })

    test.each([
        [Positions.DEV, 660905.3497942387],
        [Positions.HR, 360493.8271604938],
        [Positions.TL, 781069.9588477366],
        [Positions.PO, 841152.2633744855],
        [Positions.TPM, 901234.5679012346],
        [Positions.CTO, 1051440.329218107],
    ] as const)('учитывает коэффициент должности %s', (position, expected) => {
        expect(service.calculate(position, 100000, 2, 243, 2023)).toBeCloseTo(expected, 8)
    })

    test.each([[0, 2], [100000, 0]])('нулевой оклад или множитель дают нулевую премию', (salary, bonus) => {
        expect(service.calculate(Positions.HR, salary, bonus, 243, 2023)).toBe(0)
    })

    test.each([-1, NaN, Infinity])('отклоняет некорректный оклад %s', salary => {
        expect(() => service.calculate(Positions.HR, salary, 2, 243, 2023)).toThrow(ValidationFailedException)
    })

    test.each([-1, NaN, Infinity])('отклоняет некорректный множитель %s', bonus => {
        expect(() => service.calculate(Positions.HR, 100000, bonus, 243, 2023)).toThrow(ValidationFailedException)
    })

    test.each([0, -1, 1.5, 366])('отклоняет недопустимое число дней %s для обычного года', workDays => {
        expect(() => service.calculate(Positions.HR, 100000, 2, workDays, 2023)).toThrow(ValidationFailedException)
    })

    test('допускает 366 отработанных дней в високосном году', () => {
        expect(service.calculate(Positions.HR, 100000, 2, 366, 2024)).toBe(240000)
    })

    test.each([0, 2024.5])('отклоняет некорректный год %s', year => {
        expect(() => service.calculate(Positions.HR, 100000, 2, 243, year)).toThrow(RangeError)
    })

    test('отклоняет неизвестную должность при вызове без HTTP-валидации', () => {
        expect(() => service.calculate('UNKNOWN' as Positions, 100000, 2, 243, 2023)).toThrow(ValidationFailedException)
    })

    test('не возвращает Infinity при переполнении', () => {
        expect(() => service.calculate(Positions.HR, Number.MAX_VALUE, 2, 1, 2023)).toThrow(ValidationFailedException)
    })
})

describe('ЛР5: QuarterlyBonusService', () => {
    const service = new QuarterlyBonusServiceImpl()

    test.each([
        [Positions.TL, 195267.48971193415],
        [Positions.PO, 210288.06584362139],
        [Positions.TPM, 225308.64197530865],
        [Positions.CTO, 262860.08230452676],
    ] as const)('рассчитывает квартальную премию руководителю %s', (position, expected) => {
        expect(service.calculate(position, 100000, 2, 243, 2023)).toBeCloseTo(expected, 8)
    })

    test.each([Positions.DEV, Positions.HR])('запрещает расчёт для неуправленческой должности %s', position => {
        expect(() => service.calculate(position, 100000, 2, 243, 2023)).toThrow(UnsupportedCodeException)
    })

    test('учитывает високосный год', () => {
        expect(service.calculate(Positions.TL, 100000, 2, 243, 2024)).toBeCloseTo(195802.46913580247, 8)
    })

    test('применяет проверку исходных данных годового расчёта', () => {
        expect(() => service.calculate(Positions.TL, 100000, 2, 0, 2023)).toThrow(ValidationFailedException)
    })

    test('отклоняет неизвестную должность', () => {
        expect(() => service.calculate('UNKNOWN' as Positions, 100000, 2, 243, 2023)).toThrow(ValidationFailedException)
    })
})
