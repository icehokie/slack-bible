var _ = require('lodash')
var bodyParser = require('body-parser')
var books = require('./books')
var express = require('express')
var versions = require('./versions')
var app = express()
var http = require('follow-redirects').http
var async = require('async')

app.use(bodyParser.urlencoded({extended: true}))
app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

var booksWithPipes = _.chain(books).values().flatten().join('|').value()
var versionsWithPipes = _.chain(versions).values().flatten().join('|').value()
var regex = new RegExp('(' + booksWithPipes + ')\\.?\\s*(\\d{1,3})(?:\\s*[\\:\\s]\\s*(\\d{1,3})(?:\\s*[\\-\\s]\\s*(\\d{1,3}))?)?\\s*('+versionsWithPipes+')?','ig')
var textParser = new RegExp('og:description\" content=\"(.*)\"/>','i')

function reverseLookupBook (abbr) {
  return _.findKey(books, function (abbrs) {return _.includes(abbrs, abbr.toLowerCase())})
}

function reverseLookupTranslation (abbr) {
  return _.findKey(versions, function (abbrs) {return _.includes(abbrs, abbr.toLowerCase())})
}

app.post('/', function(request, response) {
  async.series([function(callback) {
  var inputText = request.body.text
  var res, results = []
  while ((res = regex.exec(inputText)) !== null) {
	var version = '';
    var trueRef = reverseLookupBook(res[1]) + '+' + res[2]
    if (res[3]) trueRef += ':' + res[3]
    if (res[4]) trueRef += '-' + res[4]
	if (res[5]) version = reverseLookupTranslation(res[5])
	
	if (!version)
		version = 'ESV'
	
	trueRef += '&version='+version
    results.push(trueRef)
  }

  if (results.length > 0) {
    var attachments = _.map(results, function (result) {
      var title = result.replace('+', ' ')
	  title = title.replace('&version=', ' - ')
      var link = 'https://biblegateway.com/bible?passage=' + result
	  var strText = ''
	   var options = {
			host: 'www.biblegateway.com',
			path: '/passage/?search='+result
			};

		http.get(options, function(res) {
			var bodyChunks= '';
		res.on("data", function(chunk) {
			bodyChunks += chunk;
			
		}).on("end", function() {
			var verse = textParser.exec(bodyChunks);
			if (verse && verse[1]) strText = verse[1]
			callback(false, {title:title, title_link: link, fallback: title + ' - ' + link, color: 'good', text: link+'\n*'+title+'*\n>'+strText})
		}) ;
		
		});
	  
    /**  return {
        title: title,
        title_link: link,
        fallback: title + ' - ' + link,
        color: 'good',
		text: strText
      }*/
    })
  } else {
    response.json({})
  }
  }],
  function (err, results) {
	  response.json(results[0])
  })
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'))
})
