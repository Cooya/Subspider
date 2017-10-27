// TO DO
// valider la liste des targets

// NPM dependencies
import cheerio = require('cheerio');
import path = require('path');

// Core dependencies
import {Target, Step} from './Structures.js';
import {PromiseRunner} from './PromiseRunner.js';
import db = require('../server_modules/database');
import logs = require('../server_modules/logs');

// Extension dependencies
import {targets} from './subtitles/targets.js';

interface DBResult {
	value: any;
	lastErrorObject: any;
}

declare var Promise: any;

const DB_URL = 'mongodb://localhost:27017/X';
const DB_LOGIN = 'X';
const DB_PASSWORD = 'X';
const NB_THREADS = 10;
const COLLECTION_PREFIX = 'spider.';
const INFOS_COLLECTION_NAME = COLLECTION_PREFIX + 'infos';

class Processor {
	private target: Target;
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

		return db.selectCollections(collectionNames);
	}

	private retrieveTargetInfos() {
		console.log('Retrieving target informations.');
		return db.addOrUpdateOneDoc(INFOS_COLLECTION_NAME, {target: this.target.hostname}, {target: this.target.hostname, stepIndex: 0, pageIndex: 0})
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
		});
	}

	private processTarget() {
		console.log('Starting to process target : "' + this.target.hostname + '".');
		return this.selectRequiredCollections()
		.then(function() {
			return this.retrieveTargetInfos();
		})
		.then(PromiseRunner.loop(this.processStep, this.target.steps));
	}

	private buildUrl(step) {
		return (step.inputCollection
			? db.getOneDoc(COLLECTION_PREFIX + step.inputCollection, {index: this.pageIndex})
			: Promise.resolve(step.prefixUrl + this.pageIndex + step.suffixUrl));
	}

	private processStep() {
		let currentStep = this.target.steps[this.stepIndex];
		let badLinkCounter = 0;
		let result;
		let destCollection;
		let pageIndex;

		return PromiseRunner.scheduler(function(pageIndex) {
			return buildUrl(currentStep, pageIndex) // construction de l'URL cible
			.then(sendRequest) // envoi de la requête
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
						Promise.reject('Invalid result : ' + JSON.stringify(result));

					// aiguillage des données
					destCollection = COLLECTION_PREFIX + currentStep.switcher(result);
					if(destCollection == null)
						Promise.reject('None collection returned.');

					// insertion des données dans la base de données
					pageIndex = pageIndex - NB_THREADS * 2 > 0 ? pageIndex - NB_THREADS * 2 : 0;
					return db.addOrUpdateOneDoc(destCollection, {id: target.hostname + '/' + stepIndex + '/' + pageIndex}, result)
					.then(db.updateOneDoc(INFOS_COLLECTION_NAME, {_id: target.dbInfos.dbId, target: target, stepIndex: stepIndex, pageIndex: pageIndex}))
					.then(Promise.resolve(false));
				}
			});
		}, NB_THREADS, target.dbInfos.pageIndex);
	}
}



/* Launcher */

Processor processor = new Processor();

db.loadModule(DB_URL, DB_LOGIN, DB_PASSWORD, false) // connexion à la base de données
.then(db.selectCollection(INFOS_COLLECTION_NAME))
.then(function() {
	return PromiseRunner.loop(processor.processTarget, targets);
})
.then(function() {
	console.log('done');
	process.exit(0); // le programme ne se termine pas sinon
})
.catch(function(err) {
	console.error(err);
});