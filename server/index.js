const express = require('express');
const path = require('path');
const multiparty = require('multiparty');
const fse = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.get('/post', (req, res) => {
    return res.send('Hello World!');
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
