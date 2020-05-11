'use strict';

const mime = require('mime-types');
const xml = require('xml');
const fs = require('fs');


function ifTruePush(bool, array, data) {
    if (bool) {
        array.push(data);
    }
}

function ifTruePushArray(bool, array, dataArray) {
    if (!bool) {
        return;
    }

    dataArray.forEach(function (item) {
        ifTruePush(item, array, item);
    });
}

function getSize(filename) {
    if (typeof fs === 'undefined') {
        return 0;
    }
    return fs.statSync(filename).size;
}

function generateXML(data) {

    const channel = [];
    channel.push({ title: data.title });
    channel.push({ description: data.description || data.title });
    channel.push({ link: data.site_url });
    // image_url set?
    if (data.image_url) {
        channel.push({ image: [{ url: data.image_url }, { title: data.title }, { link: data.site_url }] });
    }

    ifTruePush(data.generator, channel, { generator: data.generator });
    ifTruePush(data.lastBuilddDate, channel, { lastBuildDate: data.lastBuildDate });

    ifTruePush(data.feed_url, channel, { 'atom:link': { _attr: { href: data.feed_url, rel: 'self', type: 'application/rss+xml' } } });
    ifTruePush(data.author, channel, { 'author': data.author });
    ifTruePush(data.copyright, channel, { 'copyright': data.copyright });
    ifTruePush(data.language, channel, { 'language': data.language });
    ifTruePush(data.managingEditor, channel, { 'managingEditor': data.managingEditor });
    ifTruePush(data.webMaster, channel, { 'webMaster': data.webMaster });
    ifTruePush(data.docs, channel, { 'docs': data.docs });
    ifTruePush(data.ttl, channel, { 'ttl': data.ttl });
    ifTruePush(data.hub, channel, { 'atom:link': { _attr: { href: data.hub, rel: 'hub' } } });

    if (data.categories) {
        data.categories.forEach(function (category) {
            ifTruePush(category, channel, { category: category });
        });
    }

    ifTruePushArray(data.custom_elements, channel, data.custom_elements);

    data.items.forEach(function (item) {
        const item_values = [
            { title: item.title }
        ];
        ifTruePush(item.description, item_values, { description: item.description });
        ifTruePush(item.url, item_values, { link: item.url });
        ifTruePush(item.link || item.guid || item.title, item_values, { guid: [{ _attr: { isPermaLink: !item.guid && !!item.url } }, item.guid || item.url || item.title] });

        item.categories.forEach(function (category) {
            ifTruePush(category, item_values, { category: category });
        });

        ifTruePush(item.author || data.author, item_values, { 'dc:creator': item.author || data.author });
        ifTruePush(item.pubDate, item_values, { pubDate: new Date(item.pubDate).toGMTString() });

        //Set GeoRSS to true if lat and long are set
        data.geoRSS = data.geoRSS || (item.lat && item.long);
        ifTruePush(item.lat, item_values, { 'geo:lat': item.lat });
        ifTruePush(item.long, item_values, { 'geo:long': item.long });

        if (item.enclosure && item.enclosure.url) {
            if (item.enclosure.file) {
                item_values.push({
                    enclosure: {
                        _attr: {
                            url: item.enclosure.url,
                            length: item.enclosure.size || getSize(item.enclosure.file),
                            type: item.enclosure.type || mime.lookup(item.enclosure.file)
                        }
                    }
                });
            } else {
                item_values.push({
                    enclosure: {
                        _attr: {
                            url: item.enclosure.url,
                            length: item.enclosure.size || 0,
                            type: item.enclosure.type || mime.lookup(item.enclosure.url)
                        }
                    }
                });
            }
        }
        
        ifTruePush(item.source && item.source_url, item_values, { source: [{ _attr: { url: item.source_url } }, item.source] });
        ifTruePushArray(item.custom_elements, item_values, item.custom_elements);

        channel.push({ item: item_values });

    });

    //set up the attributes for the RSS feed.
    const _attr = data.namespaces;

    //only add namespace if GeoRSS is true
    if (data.geoRSS) {
        _attr['xmlns:geo'] = 'http://www.w3.org/2003/01/geo/wgs84_pos#';
    }

    return {
        rss: [
            { _attr: _attr },
            { channel: channel }
        ]
    };
}

function RSS(options, items) {
    options = options || {};

    this.namespaces = options.namespaces || {
        'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
        'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
        'xmlns:atom': 'http://www.w3.org/2005/Atom',
    };
    this.namespaces.version = '2.0'
    this.title = options.title || 'Untitled RSS Feed';
    this.description = options.description || '';
    this.generator = options.generator;
    this.lastBuildDate = options.lastBuildDate;
    this.feed_url = options.feed_url;
    this.site_url = options.site_url;
    this.image_url = options.image_url;
    this.author = options.author;
    this.categories = options.categories;
    this.pubDate = options.pubDate;
    this.hub = options.hub;
    this.docs = options.docs;
    this.copyright = options.copyright;
    this.language = options.language;
    this.managingEditor = options.managingEditor;
    this.webMaster = options.webMaster;
    this.ttl = options.ttl;
    //option to return feed as GeoRSS is set automatically if feed.lat/long is used
    this.geoRSS = options.geoRSS || false;
    this.custom_namespaces = options.custom_namespaces || {};
    this.custom_elements = options.custom_elements || [];
    this.items = items || [];

    Object.keys(this.custom_namespaces).forEach(namespace => {
        this.namespaces[`xmlns:${namespace}`] = this.custom_namespaces[namespace]
    });

    this.item = function (options) {
        options = options || {};
        const item = {
            title: options.title || 'No title',
            description: options.description || '',
            url: options.url,
            guid: options.guid,
            categories: options.categories || [],
            author: options.author,
            source: options.source,
            source_url: options.source_url,
            pubDate: options.pubDate,
            lat: options.lat,
            long: options.long,
            enclosure: options.enclosure || false,
            custom_elements: options.custom_elements || []
        };

        this.items.push(item);
        return this;
    };

    this.xml = function (indent) {
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            xml(generateXML(this), indent);
    };
}

module.exports = RSS;
