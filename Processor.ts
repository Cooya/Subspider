// TO DO
// valider la liste des targets

// NPM dependencies
import cheerio = require('cheerio');
import path = require('path');

process.env.SERVER_MODULES_PATH = path.resolve(__dirname, '../server_modules') + '/';
process.env.SERVER_LOGS_FILE = __dirname  + '/logs.html';

// Core dependencies
import {Target, Step} from './Structures.js';
import {PromiseRunner} from './PromiseRunner.js';
import Database = require('../server_modules/database');

// Extension dependencies
import {targets} from './subtitles/targets.js';

interface DBResult {
	value: any;
	lastErrorObject: any;
}

declare var Promise: any;

const NB_THREADS = 10;
const COLLECTION_PREFIX = 'spider.';
const INFOS_COLLECTION_NAME = COLLECTION_PREFIX + 'infos';

class Processor {
	protected target: Target;
	private stepIndex: number;
	private pageIndex: number;
	private databaseId: string;

	private selectRequiredCollections() {
		console.log('Selecting required collections.');
		var collectionNames = [];

		for(var step of this.target.steps)
			if(step.inputCollection)
				collectionNames.push(COLLECTION_PREFIX + step.inputCollection);
			for(var outputCollection of step.outputCollections)
				collectionNames.push(COLLECTION_PREFIX + step.outputCollections);

		return Database.selectCollections(collectionNames);
	}

	private retrieveTargetInfos() {
		console.log('Retrieving target informations.');
		return Database.addOrUpdateOneDoc(INFOS_COLLECTION_NAME, {target: this.target.hostname}, {target: this.target.hostname, stepIndex: 0, pageIndex: 0})
		.then(function(result: DBResult) {
			if(result.value) {
				console.log('Target already known.');
				this.databaseId = result.value._id;
				this.stepIndex = result.value.stepIndex;
				this.pageIndex = result.value.pageIndex + 1;
			}
			else {
				console.log('New target.');
				this.databaseId = result.lastErrorObject.upserted;
				this.stepIndex = 0;
				this.pageIndex = 1;
			}
		}.bind(this));
	}

	public processTarget(target: Target) {
		this.target = target;
		console.log('Starting to process target : "' + this.target.hostname + '".');
		return this.selectRequiredCollections()
		.then(this.retrieveTargetInfos.bind(this))
		.then(PromiseRunner.loop.bind(null, this.processStep.bind(this), this.target.steps));
	}

	private buildUrl(step, pageIndex) {
		return (step.inputCollection
			? Database.getOneDoc(COLLECTION_PREFIX + step.inputCollection, {index: pageIndex})
			: Promise.resolve(step.prefixUrl + pageIndex + step.suffixUrl));
	}

	private processStep(currentStep: Step) {
		const self = this;
		let badLinkCounter = 0;
		let result;
		let destCollection;

		return PromiseRunner.scheduler(function(pageIndex) {
			return self.buildUrl(currentStep, pageIndex) // construction de l'URL cible
			.then(PromiseRunner.sendRequest) // envoi de la requête
			.then(function(body) {
				if(!body) // si la ressource demandée n'existe pas	
					return Promise.resolve(++badLinkCounter >= 50);
				else {
					// récupération des données
					result = currentStep.scraper(cheerio.load(body), pageIndex);
					if(!result) // lien invalide
						return Promise.resolve(++badLinkCounter >= 50);
					badLinkCounter = 0;

					// validation des données
					if(!currentStep.validator(result))
						return Promise.reject('Invalid result : ' + JSON.stringify(result));

					// aiguillage des données
					destCollection = COLLECTION_PREFIX + currentStep.switcher(result);
					if(!destCollection)
						return Promise.reject('None collection returned.');

					// insertion des données dans la base de données
					pageIndex = pageIndex - NB_THREADS * 2 > 0 ? pageIndex - NB_THREADS * 2 : 0;
					return Database.addOrUpdateOneDoc(destCollection, {id: self.target.hostname + '/' + self.stepIndex + '/' + pageIndex}, result)
					.then(Database.updateOneDoc(INFOS_COLLECTION_NAME, {_id: self.databaseId, target: self.target, stepIndex: self.stepIndex, pageIndex: pageIndex}))
					.then(Promise.resolve.bind(Promise, false));
				}
			});
		}, NB_THREADS, self.pageIndex);
	}
}



/* Launcher */
const processor = new Processor();
const dbCredentials = require('./db_credentials');
Database.connect(dbCredentials.database, dbCredentials.login, dbCredentials.password)
.then(Database.selectCollection.bind(null, INFOS_COLLECTION_NAME))
.then(function() {
	return PromiseRunner.loop(processor.processTarget.bind(processor), targets);
})
.then(function() {
	console.log('Process done.');
	process.exit(0);
})
.catch(function(err) {
	console.error(err);
	process.exit(1);
});