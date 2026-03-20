export declare function formatConquest(
	worldState: any, conquestType: string, variantPrefix: string, title: string,
	findFn?: ((items: any[]) => any), showTimestamp?: boolean,
): Promise<string | undefined>;
export declare function formatDescendia(worldState: any, findFn?: ((items: any[]) => any), showTimestamp?: boolean): Promise<string | undefined>;
export declare function formatCalendarSeason(worldState: any, findFn?: ((items: any[]) => any), showTimestamp?: boolean): Promise<string | undefined>;
export declare function chunkMessage(first: string, rest: string[], limit?: number): string[];
