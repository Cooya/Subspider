import request = require('request');

declare var Promise: any;

export class PromiseRunner {
	static loop(action: Function, array: Array<any>, i:number = 0) {
		return action(array[i]).then(function() {
			if(++i < array.length)
				return PromiseRunner.loop(action, array, i);
		});
	}

	static scheduler(action: Function, nbThreads: number, index: number) {
		let error = false;

		var loop = function() {
			return action(index++)
			.then(function(isEnd) {
				if(!error && !isEnd) return loop();
			})
			.catch(function(err) {
				error = true;
				return err;
			});
		};

		var promises = [];
		for(var i = 0; i < nbThreads; ++i)
			promises.push(loop());

		return Promise.all(promises);	
	}

	static sendRequest(url: string) {
		return new Promise(function(resolve, reject) {
			var loop = function(nbRequests) {
				request({url: url, timeout: 10000}, function(err, res, body: string) {
					if(err) {
						if(err.code == 'ESOCKETTIMEDOUT' || err.code == 'ETIMEDOUT') {
							console.error('TIMEOUT !');
							if(nbRequests >= 5)
								reject(err);
							else
								loop(nbRequests + 1);
						}
						else
							reject(err);
					}
					else if(res.statusCode == 404) {
						console.error('404 !');
						resolve(null);
					}
					else
						resolve(body);
				});
			};
			loop(0);
		});
	}

	static runThreads(promise, index, result = []) {
		var promises = [];

		for(var step = index + 10; index < step; ++index) {
			//console.log('Running promise ' + index + '.');
			promises.push(promise(index));
		}

		return Promise.all(promises).then(function(res) {
			PromiseRunner.deepConcat(result, res);
			return PromiseRunner.runThreads(promise, index, result);
		});
	}

	private static deepConcat(array1, array2) {
		if(Array.isArray(array2[0]))
			array2.forEach(function(element) {
				PromiseRunner.deepConcat(array1, element);
			});
		else
			array2.forEach(function(element) {
				array1.push(element);
			});
	}
}