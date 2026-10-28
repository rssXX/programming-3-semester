// ЛР5: строковый enum передаётся в JSON, метаданные заменяют поля Java enum.
export enum Positions {
    DEV = 'DEV', // Developer
    HR = 'HR', // HR specialist
    TL = 'TL', // Team lead / manager
    PO = 'PO', // Product owner
    TPM = 'TPM', // Technical product manager
    CTO = 'CTO', // Chief technology officer
}

export const POSITION_DETAILS = {
    [Positions.DEV]: { positionCoefficient: 2.2, isManager: false },
    [Positions.HR]: { positionCoefficient: 1.2, isManager: false },
    [Positions.TL]: { positionCoefficient: 2.6, isManager: true },
    // Коэффициенты PO/TPM/CTO не заданы в методичке: приняты в рамках этой работы.
    [Positions.PO]: { positionCoefficient: 2.8, isManager: true },
    [Positions.TPM]: { positionCoefficient: 3.0, isManager: true },
    [Positions.CTO]: { positionCoefficient: 3.5, isManager: true },
} as const satisfies Record<Positions, { readonly positionCoefficient: number; readonly isManager: boolean }>
