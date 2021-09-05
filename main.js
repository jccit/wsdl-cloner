#!/usr/bin/env node
const xml2js = require('xml2js');
const axios = require('axios');
const util = require('util');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

let wsdlRoot = '';
const seen = [];

const argv = yargs(hideBin(process.argv))
    .usage('Usage: wsdl-cloner -w [url]')
    .alias('w', 'wsdl')
    .demandOption(['wsdl'])
    .describe('wsdl', 'URL to WSDL file')
    .alias('o', 'out')
    .demandOption(['out'])
    .describe('out', 'Folder to output to')
    .argv

async function downloadFile(base, file) {
    return axios.get(`${base}/${file}`);
}

function saveFile(file, xml) {
    const outFile = path.join(argv.out, file);
    fs.writeFile(outFile, xml, (err) => {
        if (err) {
            console.error(err);
            return;
        }
    });
}

async function downloadAndFindImports(base, file) {
    if (seen.indexOf(file) === -1) {
        const response = await downloadFile(base, file);
        const xml = response.data;
        const parser = new xml2js.Parser();
        const json = await parser.parseStringPromise(xml);

        seen.push(file);

        console.log(file);

        saveFile(file, xml);
        searchObject(json);
    }
}

// Deep search in object keys
function searchObject(obj) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === 'object') {
                searchObject(obj[key]);
            } else if (typeof obj[key] === 'array') {
                for (const item of obj[key]) {
                    searchObject(item);
                }
            } else {
                // Check if a key contains location
                if (key.toLowerCase().includes('location')) {
                    // Check if value ends in .wsdl or .xsd
                    if (obj[key].toLowerCase().endsWith('.wsdl') || obj[key].toLowerCase().endsWith('.xsd')) {
                        downloadAndFindImports(wsdlRoot, obj[key]);
                    }
                }
            }
        }
    }
}

if (argv.wsdl) {
    // Seperate WSDL URL into base and file path
    const wsdl = argv.wsdl;
    const base = wsdl.substring(0, wsdl.lastIndexOf('/'));
    const file = wsdl.substring(wsdl.lastIndexOf('/') + 1);

    wsdlRoot = base;

    downloadAndFindImports(base, file);
}