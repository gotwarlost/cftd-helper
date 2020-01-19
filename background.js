(function (chrome) {
    const dc = chrome.declarativeContent;
    const pc = dc.onPageChanged;
    pc.removeRules(undefined, function() {
        pc.addRules([{
            conditions: [new dc.PageStateMatcher({
                pageUrl: {
                    hostEquals: 'www.facebook.com',
                    pathPrefix: '/groups/cryptics/permalink/',
                },
            })
            ],
            actions: [new dc.ShowPageAction()]
        }]);
    });
    chrome.pageAction.onClicked.addListener(function () {
        chrome.tabs.executeScript({
            file: 'cftd-helper.js',
        });
    });
})(chrome);
