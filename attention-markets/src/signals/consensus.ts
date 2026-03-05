export interface SourceInfo {
    name: string;
    data: Record<string, any> | null;
}

export interface ConsensusResult {
    score: number; // [0,1] — fraction of sources returning real signals
    active: number;
    total: number;
}

/**
 * Compute cross-platform consensus.
 * A source is "active" if it returned data AND at least one numeric metric is > 0.
 * Pure in-memory — no DB calls needed.
 */
export function computeConsensus(sources: SourceInfo[]): ConsensusResult {
    const total = sources.length;

    const active = sources.filter(({ data }) => {
        if (!data) return false;
        const numericVals = Object.values(data).filter(v => typeof v === 'number');
        return numericVals.some(v => (v as number) > 0);
    }).length;

    return {
        score: total > 0 ? active / total : 0,
        active,
        total,
    };
}
