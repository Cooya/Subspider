# Subspider

## Installation
* Start MongoDB server on the machine (default port)
* "npm install" in the root folder of the project for install dependencies
* In the same folder, create and complete "db_credentials.js" file as follows :
```javascript
module.exports = {
	"database": "",
	"login": "",
	"password": ""
};
```
* The typescript compiler ("tsc") must be installed in global on the machine
* "npm start" for compile typescript and run the script