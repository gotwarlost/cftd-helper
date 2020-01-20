// ==UserScript==
// @name         cotd-helper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  COTD helper for cryptic crossword society pages. Can be used as a tampermonkey script or directly from plugin.
// @author       gotwarlost
// @match        https://www.facebook.com/groups/cryptics/permalink/*
// @grant        none
// ==/UserScript==
(function (isTampermonkey) {
    'use strict';
    // multi-space regex
    const squishRE = new RegExp('  *', 'g');

    // extractText extracts the text content from a list of nodes, ignoring anchors
    function extractText(nodes) {
        if (!(nodes && nodes.forEach)) {
            return '';
        }
        const segments = [];
        nodes.forEach(function (node) {
            const nt = node.nodeType;
            if (nt === 3) { // text node
                segments.push(node.nodeValue);
                return;
            }
            if (nt !== 1) { // not element
                return;
            }
            const tag = node.tagName.toLowerCase();
            if (tag === 'a') { // don't include links content (typically mentions), but preserve hashtags
                if (node.getAttribute('href').toLowerCase().startsWith('https://www.facebook.com/hashtag/')) {
                    segments.push(node.textContent);
                }
                return;
            }
            if (tag === 'br') {
                segments.push('');
                return;
            }
            const innerText = extractText(node.childNodes);
            if (innerText !== '') {
                segments.push(innerText);
            }
        });
        return segments.join(' ').replace(squishRE, ' ').trim();
    }

    // extractClues extracts clue information from the comments.
    // This is extremely flaky and buggy by definition since it relies on the internals of the FB markup.
    function extractClues() {
        const clues = [];
        const commentRoots = document.querySelectorAll('div[data-testid="UFI2Comment/root_depth_0"]');
        commentRoots.forEach(function (root) {
            const comment = root.querySelector('div[data-testid="UFI2Comment/body"]');
            if (!comment) {
                console.log('internal error: unable to find comment body');
                return;
            }
            // only the first one otherwise you get all mentions, replies etc.
            const personLink = comment.querySelector('a[data-hovercard]');
            if (!personLink) {
                return;
            }
            const parent = personLink.parentNode;

            const spans = parent.querySelectorAll(':scope > span');
            const text = extractText(spans);
            if (text === '') {
                return;
            }
            // extract number of reactions
            let numReactions = '0';
            let numReactionTypes = '0';
            const reactions = root.querySelector('span[data-testid="UFI2CommentTopReactions/tooltip"]');
            if (reactions) {
                numReactions = reactions.textContent;
                const rt = reactions.querySelectorAll('span > i');
                numReactionTypes = rt ? String(rt.length) : '0';
            }
            clues.push({
                name: personLink.textContent,
                text: text,
                numReactions: numReactions,
                numReactionTypes: numReactionTypes,
            });
        });
        return clues;
    }

    const ampRE = new RegExp('&', 'g');
    const ltRE = new RegExp('<', 'g');
    const gtRE = new RegExp('>', 'g');

    // encodeEntities sanitizes the input string to escape tags.
    function encodeEntities(value) {
        return value.replace(ampRE, '&amp;').replace(ltRE, '&lt;').replace(gtRE, '&gt;');
    }

    // writeDocument writes the output to an empty document
    function writeDocument(doc, clues) {
        const lines = [];
        let count = 0;
        clues.forEach(function (info) {
            count += 1;
            lines.push([
                '<tr class="' + (count % 2 === 0 ? 'even' : 'odd')+ '">',
                '<td class="num">' + count + '</td>',
                '<td class="name">' + encodeEntities(info.name) + '</td>',
                '<td>' + encodeEntities(info.text) + '</td>',
                '<td  class="num">' + encodeEntities(info.numReactions) + '</td>',
                '<td  class="num">' + encodeEntities(info.numReactionTypes) + '</td>',
                '</tr>',
            ].join('\n'));
        });
        const tHead = [
            '<thead>',
            '<tr>',
            '<th class="num">#</th>',
            '<th>Clued by</th>',
            '<th>Clue</th>',
            '<th class="num"># reactions</th>',
            '<th class="num"># reaction types</th>',
            '</tr>',
            '</thead>'
        ].join('\n');
        const table = '<table>' + tHead + '<tbody>' + lines.join('\n') + '</tbody><table>';
        const header = [
            '<html lang="en-us">',
            '<head>',
            '<title>Clue table</title>',
            '<style type="text/css">',
            'body { margin: 1em; color: #333; }',
            'table { font-family: "Franklin ITC Light",sans-serif; font-size: 11pt; }',
            'td,th { padding: 0.25em 0.5em 0.25em 0.5em; border: 1px solid #ddd; text-align: left; }',
            'td.num,th.num { text-align: right; }',
            'tr.even > td { background: #eee; }',
            'td.name { white-space: nowrap; }',
            'table { border-collapse: collapse; }',
            '</style>',
            '</head>',
            '<body>'
        ].join('\n');
        doc.open();
        doc.write(header);
        doc.write(table);
        doc.write('</body></html>');
    }

    // handler is the on-click handler for the inserted button
    function handler() {
        const clues = extractClues();
        const w = window.open();
        if (!w) {
            alert("unable to open new window");
            return;
        }
        writeDocument(w.document, clues);
    }
    // insertButton inserts our button as a previous sibling of the supplied node
    function insertButton(commentNode) {
        const el = document.createElement('button');
        el.setAttribute('id','clue-dump');
        el.setAttribute('type','button');
        el.setAttribute('style', 'color: white; background: #4CAF50; font-size: 150%;');
        el.appendChild(document.createTextNode('Extract clues'));
        el.addEventListener('click', handler);

        const wrapper = document.createElement('div');
        wrapper.setAttribute('style','padding: 0.1em; margin: 0.5em 1em; text-align: right');
        wrapper.appendChild(el);
        commentNode.parentNode.insertBefore(wrapper,commentNode);
    }

    // main is the main function that creates the clue list.
    function main() {
        if (isTampermonkey) {
            const ucw = document.querySelector('div.userContentWrapper');
            if (!ucw) {
                console.log('unable to find button insertion point, abort');
                return
            }
            insertButton(ucw);
            return;
        }
        // if running in our extension just run the handler.
        handler();
    }
    main();
})(typeof GM_info !== "undefined");
