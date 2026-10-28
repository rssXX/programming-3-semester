export class DateTimeUtil {
    static getCustomFormat(date: Date): string {
        return date.toISOString()
    }
}
