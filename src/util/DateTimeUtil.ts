export class DateTimeUtil {
    /** ЛР5: число календарных дней с учётом правила 4/100/400 григорианского календаря. */
    static getDaysInYear(year = new Date().getFullYear()): number {
        if (!Number.isInteger(year) || year < 1 || year > 9999) {
            throw new RangeError('Год должен быть целым числом от 1 до 9999')
        }
        return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0) ? 366 : 365
    }

    static getCustomFormat(date: Date): string {
        return date.toISOString()
    }
}
