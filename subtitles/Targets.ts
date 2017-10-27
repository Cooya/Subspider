import {Subtitle, MovieSubtitle, SerieSubtitle} from './Structures.js';
import {Target} from '../Structures.js';

export let targets = [
	new Target('www.yifysubtitles.com', true, [
		{
			prefixUrl: 'http://www.yifysubtitles.com/subtitles/x-',
			suffixUrl: '',
			outputCollections: ['movies'],
			validator: validator,
			switcher: switcher,
			scraper: function($, index) {
				if($('body > div:nth-child(7)').text() == 'subtitle is removed') {
					//console.error('subtitle is removed : ' + index + '.');
					return null;
				}
				if($('body > span:nth-child(7)').text() == 'Movie does not exist') {
					//console.error('Movie does not exist : ' + index + '.');
					return null;
				}

				var release = $('div.col-xs-12:nth-child(3)').text().trim();
				var file = $('.btn-icon.download-subtitle').attr('href').trim();
				var language = $('li.list-group-item:nth-child(1) > span:nth-child(1)').text().toLowerCase().trim();
				var movie = $('h2').text().trim();

				if(movie == '') // Agoraphobia
					return null;

				process.stdout.write('\r\x1b[K' + index + ' - ' + movie + ' - ' + language);
				return new MovieSubtitle(this.hostname, index, release, file, language, movie);
			}
		}
	]),
	new Target('www.tv-subs.com', true, [
		{
			prefixUrl: 'http://www.tv-subs.com/subtitles/x-',			
			suffixUrl: '',
			outputCollections: ['series'],
			validator: validator,
			switcher: switcher,
			scraper: function($, index) {
				if($('#content > span:nth-child(1)').text() == 'TV show does not exist') {
					//console.error('TV show does not exist : ' + index + '.');
					return null;
				}

				var title = $('h2').text();
				var titleSplit = title.split(' ');

				var release = title.split(titleSplit[titleSplit.length - 2])[0].trim();
				var file = $('.btn-icon.download-subtitle').attr('href').trim();
				var language = titleSplit[titleSplit.length - 2].toLowerCase().trim();
				var serie = $('img.box-shadow').attr('alt').trim();
				var season = parseInt($('div.sub-info:nth-child(1) > span:nth-child(1)').text());
				var episode = parseInt($('div.sub-info:nth-child(2) > span:nth-child(1)').text());

				process.stdout.write('\r\x1b[K' + index + ' - ' + serie + ' - ' + language);
				return new SerieSubtitle(this.hostname, index, release, file, language, serie, season, episode);
			}
		}
	]),
	new Target('www.tvsubs.net', true, [
		{
			prefixUrl: 'http://www.tvsubs.net/subtitle-',
			suffixUrl: '.html',
			outputCollections: ['series'],
			validator: validator,
			switcher: switcher,
			scraper: function($, index) {
				if($('title').text() == 'Download TV Show subtitles - TVsubs.net') {
					//console.error('Invalid link : ' + index + '.');
					return null;
				}

				var release = $('ul.list2:nth-child(3) > li:nth-child(2)').text().split(':')[1].trim();
				var file = $('a[href="download-' + index + '.html"]').attr('href').trim();
				var language = $('ul.list2:nth-child(3) > li:nth-child(1)').text().split(':')[1].toLowerCase().trim();
				var serie = $('ul.list2:nth-child(3) > li:nth-child(3) > a:nth-child(2)').text().trim();
				var season = parseInt($('ul.list2:nth-child(3) > li:nth-child(4)').text().split(':')[1]);
				var episode = parseInt($('ul.list2:nth-child(3) > li:nth-child(5) > a:nth-child(2)').text().split(' - ')[0]);

				process.stdout.write('\r\x1b[K' + index + ' - ' + serie + ' - ' + language);
				return new SerieSubtitle(this.hostname, index, release, file, language, serie, season, episode);
			}
		}
	]),
	new Target('www.opensubtitles.org', true, [
		{
			prefixUrl: 'https://www.opensubtitles.org/en/subtitles/',
			suffixUrl: '',
			outputCollections: ['movies, series'],
			validator: validator,
			switcher: switcher,
			scraper: function($, index) {
				if($('title').text() == 'Subtitles - download movie and TV Series subtitles from the biggest open subtitles database')
					return null;

				var titleSplit = $('h1 span[itemProp="name"]').text().split(' subtitles');

				var release = $('a.none:nth-child(5)').text().trim();
				var file = $('#moviehash > a:nth-child(1)').attr('href').trim();
				var language = titleSplit.split(' ')[1].toLowerCase().trim();

				var season = parseInt($('span[itemProp="seasonNumber"]'));
				if(!season) {
					var movie = titleSplit[0].trim();

					process.stdout.write('\r\x1b[K' + index + ' - ' + movie + ' - ' + language);
					return new MovieSubtitle(this.hostname, index, release, file, language, movie);
				}
				else {
					var serie = titleSplit[0].trim();
					var episode = parseInt($('span[itemProp="episodeNumber"]'));

					process.stdout.write('\r\x1b[K' + index + ' - ' + serie + ' - ' + language);
					return new SerieSubtitle(this.hostname, index, release, file, language, serie, season, episode);
				}
			}
		}
	])
];

function switcher(sub: Subtitle) {
	if(sub instanceof MovieSubtitle)
		return 'movies';
	else if(sub instanceof SerieSubtitle)
		return 'series';
	else
		return null;
}

function validator(sub: Subtitle) {
	for(var key of Object.keys(sub)) {
		if(typeof sub[key] === 'number') {
			if(!Number.isInteger(sub[key]))
				return false;
			continue;
		}
		if(typeof sub[key] === 'string') {
			if(key == 'release') { // la release peut valoir une chaîne vide
				if(sub[key] == null)
					return false;
				continue;
			}
			if(sub[key] == null || sub[key] == '')
				return false;
			continue;
		}
		return false;
	}
	return true;
}

function linksMatch($: any, pattern: RegExp) {
	let links = $('a');
	let href;
	let result = [];
	
	$(links).each(function(i, link) {
		href = $(link).attr('href');
		if(pattern.exec(href))
			result.push('http://www.tv-subs.com' + href);
	});

	return result;
}