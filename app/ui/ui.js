var express = require('express');
var fs = require("fs");
var app = express();
var cors = require('cors')
const path = require('path');

app.use(express.json())
app.use(cors())

app.use(express.static("public"));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});


app.listen(2021, () => {
    console.log("UI au rapport.")
})