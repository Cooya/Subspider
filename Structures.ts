export interface Step {
	prefixUrl?: string;
	suffixUrl?: string;
	inputCollection?: string; // collection to retrieve links from
	outputCollections: Array<string>; // collections which will contain result data
	scraper: Function; // retrieve data from the page
	validator: Function // check if the return object is correct
	switcher: Function // return the destination collection according to data
}

export class Target {
	hostname: string;
	betaVersion: boolean;
	steps: Array<Step>;

	constructor(hostname: string, betaVersion: boolean, steps: Array<Step>) {
		this.hostname = hostname;
		this.betaVersion = betaVersion;
		this.steps = steps;
	}
}