console.log("popup loaded");

const OPENAI_API_KEY = ""; 


let prompts = {};
let searchResults = [];

fetch('prompts.json')
    .then(response => response.json())
    .then(data => {
        prompts = data;
    })


async function callChatGPT(prompt) {
    console.log("sending now!!!", prompt)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-5.4",
            messages: [
                { role: "user", content: prompt }
            ],
            max_completion_tokens: 25000
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log(data.choices, data.model, data.usage)
    return data.choices?.[0]?.message?.content || "No response returned.";
}

function addMessageToChat(text, isUser) {
    const chatContainer = document.getElementById("chatContainer");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user" : "assistant"}`;
    
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;
    
    messageDiv.appendChild(bubble);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


document.addEventListener("DOMContentLoaded", initUI);

function initUI() {
    const button = document.getElementById("promptButton");
    const promptInput = document.getElementById("promptInput");

    button.disabled = true;

    inputListener(button, promptInput);
    promptListener(button, promptInput);
    keydownListener(button, promptInput);
}

function inputListener(button, promptInput) {
    promptInput.addEventListener("input", function() {
        button.disabled = !promptInput.value.trim();
        
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 300) + 'px';
    });
}

function keydownListener(button, promptInput) {
    promptInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter" && !event.shiftKey && !button.disabled) {
            event.preventDefault();
            button.click();
        }
    });
}


function promptListener(button, promptInput) {
    button.addEventListener("click", async function() {
        const userPrompt = promptInput.value.trim();

        if (!userPrompt) {
            return;
        }

        if (userPrompt.startsWith("/search")) {
            const searchTerm = userPrompt.slice(7).trim(); 
            if (searchTerm) {
                addMessageToChat(userPrompt, true);
                promptInput.value = "";
                button.disabled = true;
                const finalTerm = await callChatGPT(`${prompts.search} "${searchTerm}"`);
                
                const searchTab = await doSearch(finalTerm);
                addMessageToChat(`Opening Google search for: "${finalTerm}"`, false);

                try {
                    searchResults = await listSearchResults(searchTab.id);

                    const chosenResultIndex = await callChatGPT(`${prompts.chooseResult1} "${searchTerm}"\n\n${prompts.chooseResult2}\n\n${JSON.stringify(searchResults)}`);
                    console.log("Chosen result index from ChatGPT:", chosenResultIndex);

                    if (searchResults.some(result => result.ResultOption === parseInt(chosenResultIndex))) {
                        resultTitle = searchResults.find(result => result.ResultOption === parseInt(chosenResultIndex))?.title || "unknown result";
                        addMessageToChat(`Opening search result: "${resultTitle}"`, false);
                        
                        try {
                            const resultTab = await openSearchResult(searchResults, parseInt(chosenResultIndex));
                            
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            const domContent = await readDOM(resultTab.id);
                            console.log("object: " + domContent);
                            const summary = await callChatGPT(`${prompts.resultSummary1} "${userPrompt}"\n\n${prompts.resultSummary2}\n\n${domContent}`);
                            addMessageToChat(summary, false);
                        } catch (error) {
                            console.error("error:", error.message);
                            addMessageToChat(`Error: Could not read page content`, false);
                        }
                    }
                } catch (error) {
                    console.error("error:", error.message);
                    addMessageToChat(`Error: Could not list search results`, false);
                }

            } else {
                addMessageToChat("Usage: /search [search term]", false);
            }
            button.disabled = false;
            return;
        }

        if (userPrompt.startsWith("/summarize")) {
            const userQuestion = userPrompt.slice(10).trim();
            if (!userQuestion) {
                addMessageToChat("Usage: /summarize [your question about the current page]", false);
                return;
            }

            addMessageToChat(userPrompt, true);
            promptInput.value = "";
            button.disabled = true;

            const domContent = await readDOM((await chrome.tabs.query({active: true, currentWindow: true}))[0].id);
            const summary = await callChatGPT(`${prompts.summarize1} "${userQuestion}" \n\n${prompts.summarize2}\n\n${domContent}`);
            addMessageToChat(summary, false);
            return;
        }

        if (userPrompt.startsWith("/picross")) {
            promptInput.value = "";
            button.disabled = true;
            addMessageToChat(userPrompt, true);
            const [tab] = (await chrome.tabs.query({active:true, currentWindow: true}))

            let picrossTab = tab;
            if (!(tab.url.includes("liouh.com/picross"))) {
                picrossTab = await openURL("https://liouh.com/picross");
            } 

            let customGame = false;
            const customSeed = userPrompt.slice(8);
            if (customSeed != "") {
                customGame = true;
            }

            try {                

                const clickableElements = await listClickableElements(picrossTab.id)
                console.log(clickableElements)

                if (!customGame) {
                    await clickElement(picrossTab.id, clickableElements[8]);
                } else {
                    await fillInput(picrossTab.id, clickableElements[10], customSeed);
                    await clickElement(picrossTab.id, clickableElements[11])
                }

                const picross = await readPicrossKeys(picrossTab.id);
                console.log(`topkeys: ${JSON.stringify(picross.topKeys)}, \n left keys: ${JSON.stringify(picross.leftKeys)}`)
                const picrossResponse = await callChatGPT(`${prompts.picross1} ${picross.topKeys.join(' | ')} ${prompts.picross2} ${picross.leftKeys.join(' | ')} `);     
                addMessageToChat(picrossResponse, false);

            const rows = picrossResponse.split("\n");
            for (const [y, row] of rows.entries()) {
                for (const [x, square] of row.split('').entries()) {
                    if (square === "1") {
                        await clickPicrossElement(picrossTab.id, x, y);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }


            } catch (error) {
                console.error("error:", error.message);
                addMessageToChat(`Error: Could not read Picross keys`, false);
            }

            return;
        }

        if (userPrompt.startsWith("/click")) {

            const userQuestion = userPrompt.slice(6).trim();
            if (!userQuestion) {
                addMessageToChat("Usage: /click [What you want to do on the page]", false);
                return;
            }

            promptInput.value = "";
            button.disabled = true;
            addMessageToChat(userPrompt, true);

            try {
                const [tab] = (await chrome.tabs.query({active:true, currentWindow: true}))
                const domContent = await readDOM(tab.id);
                const clickableElements = await listClickableElements(tab.id);

                const clickResponse = await callChatGPT(`${prompts.click1} ${domContent} \n ${prompts.click2} ${JSON.stringify(clickableElements)} \n ${prompts.click3} ${userQuestion}`);
                const element = clickableElements[parseInt(clickResponse)];
                addMessageToChat(`Clicking index ${clickResponse} (${element.tag}: ${element.id || element.text || "unknown"})`, false);

                const click = await clickElement(tab.id, element);
                if (click) {
                    addMessageToChat("Attempting Click", false);
                }
                else {
                    addMessageToChat("Click failed", false);
                }

            } catch (error) {
                console.log("error: ", message);
                addMessageToChat(`Error: Could not find clickable elements`, false);
            }

            return

        }

        if (userPrompt.startsWith("/fill")) {
            const fillTerm = userPrompt.slice(5).trim(); 
            if (fillTerm) {
                addMessageToChat(userPrompt, true);
                promptInput.value = "";
                button.disabled = true;
                
                try {
                    const [tab] = (await chrome.tabs.query({active:true, currentWindow: true}))
                    const domContent = await readDOM(tab.id);
                    const clickableElements = await listClickableElements(tab.id);

                    const fillResponse = await callChatGPT(`${prompts.fill1} ${domContent} \n ${prompts.fill2} ${JSON.stringify(clickableElements)} \n ${prompts.fill3} ${fillTerm}`);
                    const [elementIndex, textString] = fillResponse.split('\n');

                    console.log(clickableElements)
                    console.log(fillResponse)
                    element = clickableElements[elementIndex];

                    addMessageToChat(`Filling index ${elementIndex} (${element.tag}: ${element.id || element.text || "unknown"}) with ${textString}`, false);
                    const filling = await fillInput(tab.id, element, textString);
                    console.log(filling ? "filled" : "not filled");


                } catch (error) {
                    console.error("error:", error.message);
                    addMessageToChat(`Error: Could not fill`, false);
                }

            } else {
                addMessageToChat("Usage: /fill [what you want filled and how]", false);
            }
            button.disabled = false;
            return;
        }


        if (userPrompt.startsWith("/")) {
            addMessageToChat("Unknown command. Available commands: /search [term], /summarize [question], /picross, /fill [what needs filling], /click [what you want clicked]", false);
            return;
        }

        addMessageToChat(userPrompt, true);
        promptInput.value = "";
        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const result = await callChatGPT(userPrompt);
            console.log("ChatGPT response:", result);
            addMessageToChat(result, false);
        } catch (error) {
            console.error(error);
            addMessageToChat(`Error: ${error.message}`, false);
        } finally {
            button.disabled = !promptInput.value.trim();
            button.textContent = "Send";
        }
    });
}



async function readDOM(tabId) {
    console.log("reading dom from tab:", tabId);
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"],
        });
    } catch (error) {
        console.error("cant inject script into this page:", error.message);
        throw error;
    }

    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: "getDOM" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error:", chrome.runtime.lastError.message);
                reject(chrome.runtime.lastError);
                return;
            }
            const cleanDom = readableDom(response.dom); 
            console.log("DOM of current tab received:", cleanDom);

            resolve(cleanDom);
        });
    });
}

async function doSearch(searchTerm = "") {
    const encodedSearch = encodeURIComponent(searchTerm);
    const url = searchTerm ? `https://www.google.com/search?q=${encodedSearch}` : "about:blank";
    
    return new Promise((resolve) => {
        chrome.tabs.create({ url: url }, (newTab) => {
            chrome.tabs.onUpdated.addListener(function onTabUpdate(tabId, changeInfo) {
                if (tabId === newTab.id && changeInfo.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(onTabUpdate);
                    resolve(newTab);
                }
            });
        });
    });
}

async function openURL(url) {
    return new Promise((resolve) => {
        chrome.tabs.create({url: url}, (newTab) => {
            chrome.tabs.onUpdated.addListener(function onTabUpdate(tabId, changeInfo) {
                if (tabId === newTab.id && changeInfo.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(onTabUpdate);
                    resolve(newTab);
                }
            })
        })
    })
}



async function listSearchResults(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {action: "listResults"}, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response?.results || []);
        });
    });
}


function openSearchResult(results, index) {
    const url = results.find(result => result.ResultOption === index)?.url;
    if (url) {
        return new Promise((resolve) => {
            chrome.tabs.create({url: url}, (newTab) => {
                console.log(`Opening search result ${index} at ${url}`);
                resolve(newTab);
            });
        });
    }
    else {
        console.log(`No search result ${index}`);
        return Promise.reject(new Error(`No search result at index ${index}`));
    }
}


function readableDom(domString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(domString, 'text/html');

    const SKIP_TAGS = new Set([
        "script", "style", "noscript", "iframe", "canvas", "svg",
        "video", "audio", "head", "footer", "nav"
    ]);

    const BLOCK_CHILDREN = new Set([
        "p", "li", "h1", "h2", "h3", "h4", "h5", "h6",
        "div", "section", "article", "ul", "ol", "table"
    ]);

    SKIP_TAGS.forEach(tag =>
        doc.querySelectorAll(tag).forEach(el => el.remove())
    );

    const lines = [];

    function extractText(el) {
        return el.innerText?.trim() ?? "";
    }

    function traverseNode(element) {
        const tag = element.tagName?.toLowerCase();
        if (!tag) return;

        if (tag === "a" || tag === "button") {
            const text = extractText(element);
            const href = element.getAttribute("href");
            if (text) {
                lines.push(href
                    ? `[link: ${text} -> ${href}]`
                    : `[button: ${text}]`
                );
            }
            return;
        }

        if (tag === "input" || tag === "textarea" || tag === "select") {
            const type = element.getAttribute("type") || tag;
            const name = element.getAttribute("name") || element.getAttribute("id") || "";
            const placeholder = element.getAttribute("placeholder") || "";
            lines.push(
                `[input type=${type} name="${name}"` +
                (placeholder ? ` placeholder="${placeholder}"]` : "]")
            );
            return;
        }

        if (/^h[1-6]$/.test(tag)) {
            const text = extractText(element);
            const level = parseInt(tag[1], 10);
            const indent = "  ".repeat(level - 1);
            if (text) lines.push(`\n${indent}## ${text}`);
            return;
        }

        if (["p", "li", "td", "th", "caption", "blockquote", "label"].includes(tag)) {
            const text = extractText(element);
            const prefix = tag === "li" ? "  -" : tag === "blockquote" ? "  >" : "";
            if (text) lines.push(prefix ? `${prefix} ${text}` : text);
            return;
        }

        if (["span", "div", "section", "article"].includes(tag)) {
            const hasBlockChildren = [...element.children].some(c =>
                BLOCK_CHILDREN.has(c.tagName?.toLowerCase())
            );
            if (!hasBlockChildren) {
                const text = extractText(element);
                if (text) lines.push(text);
                return;
            }
            for (const child of element.children) traverseNode(child);
            return;
        }

        for (const child of element.children) traverseNode(child);
    }

    traverseNode(doc.body);

    return lines
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
}

async function readPicrossKeys(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {action: "listPicrossKeys"}, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                console.log("???")
                return;
            }
            resolve(response ||[]);
        })
    })
}


async function getGrid(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {action: "listPicrossSquares"}, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                console.log("???")
                return;
            }
            resolve(response ||[]);
        })
    })
}

async function clickPicrossElement(tabId, x, y) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {action: "clickPicrossElement", x, y}, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response);
        })
    })
}

async function listClickableElements(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {action: "listClickableElements"}, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response);
        })
    })
}

async function clickElement(tabId, elementData) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {action: "clickElement", elementData}, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response);
        })
    })
}

async function fillInput(tabId, elementData, text) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {action: "fillInput", elementData, text}, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response);
        })
    })
} 





//tekstikenttien täyttö, 