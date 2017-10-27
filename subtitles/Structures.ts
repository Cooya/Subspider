export class Subtitle {
	target: string;
	index: number;
	release: string;
	file: string;
	language: string;

	constructor(target: string, index: number, release: string, file: string, language: string) {
		this.target = target;
		this.index = index;
		this.release = release;
		this.file = file;
		this.language = language;
	}
}

export class MovieSubtitle extends Subtitle {
	movie: string;

	constructor(target: string, index: number, release: string, file: string, language: string, movie: string) {
		super(target, index, release, file, language);
		this.movie = movie;
	}
}

export class SerieSubtitle extends Subtitle {
	serie: string;
	season: number;
	episode: number;

	constructor(target: string, index: number, release: string, file: string, language: string, serie: string, season: number, episode: number) {
		super(target, index, release, file, language);
		this.serie = serie;
		this.season = season;
		this.episode = episode;
	}
}