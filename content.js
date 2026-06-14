

function clickFirstSearchResult() {
    const firstResult = document.querySelector('h3')?.closest('a');
    console.log("result: " +  firstResult)
    if (firstResult) {
        firstResult.click();
        return { success: true, message: "Clicked first search result" };
    } else {
        console.log("No search result found");
        return { success: false, message: "No search result found" };
    }
}

function listSearchResults() {
    const results = [];
    const h3Elements = document.querySelectorAll('h3');
    
    h3Elements.forEach((h3, index) => {
        const link = h3.closest('a');
        if (link) {
            results.push({
                ResultOption: index,
                title: h3.textContent,
                url: link.href
            });
        }
    });
    
    return { success: true, results: results, count: results.length };
}

function listPicrossKeys() {
    
    const topKeys = [];
    const leftKeys = [];
    
    const keys = document.querySelectorAll('td').forEach(td => {
        const tdClass = td.className;
        const content = td.textContent.trim();
        if (tdClass === "key top") {
            topKeys.push(content)
        } 
        else if (tdClass === "key left") {
            leftKeys.push(content);
        }
    });

    return { success: true, topKeys, leftKeys}
    
}

function listPicrossSquares() {
    const grid = []

    const squares = document.querySelectorAll('td').forEach(td => {
        const tdClass = td.className;
        const xCoord = td.dataset.x;
        const yCoord = td.dataset.y;
        if (tdClass.includes("cell")) {
            grid.push({x: xCoord, y: yCoord})
        }
    })
    return grid;

}

function clickPicrossElement(y, x) {
    
    const td = document.querySelector(`td[data-x="${x}"][data-y="${y}"]`)
    if (document.contains(td)) {
        td.dispatchEvent(new MouseEvent("mousedown", {bubbles: true}));
        td.dispatchEvent(new MouseEvent("mouseup", {bubbles: true}));
        return true;
    }
    else {
        console.log("ei mittä")
        return false;
    }
}

function listClickableElements() {
    const clickableThings = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "summary",         
    "audio[controls]",
    "video[controls]",

    "[role='button']",
    "[role='link']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='menuitem']",
    "[role='menuitemcheckbox']",
    "[role='menuitemradio']",
    "[role='option']",
    "[role='switch']",
    "[role='tab']",
    "[role='treeitem']",
    "[role='gridcell']",
    "[role='columnheader']",
    "[role='rowheader']",
    "[role='combobox']",
    "[role='listbox']",
    "[role='slider']",
    "[role='spinbutton']",
    "[role='searchbox']",

    "[tabindex]",
    "[contenteditable]",
    "[onclick]",
    "[onmousedown]",
    "[onmouseup]",
    "[onkeydown]",
    "[onkeyup]",
    "[onkeypress]",
    ];

    const candidates = new Set(document.querySelectorAll(clickableThings.join(",")));

    document.querySelectorAll("*").forEach((element) => {
        const style = window.getComputedStyle(element);
        if (style.cursor === "pointer") {
            candidates.add(element);
        }
    });

    const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 0 &&
            rect.height > 0
        );
    };

    const isDisabled = (element) => {
        return (
            element.disabled === true ||
            element.getAttribute("aria-disabled") === "true" ||
            element.closest("[disabled]") !== null
        );
    };

    const isNegativeTabindex = (element) => {
        const tabindex = element.getAttribute("tabindex");
        if (tabindex !== "-1") return false;

        const hasRole = element.hasAttribute("role");
        const hasClick =  element.hasAttribute("onclick") || element.hasAttribute("onmousedown");

        return !hasRole && !hasClick;
    };

    const results = [...candidates]
    .filter((element) => isVisible(element) && !isDisabled(element) && !isNegativeTabindex(element))
    .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        text: element.innerText?.trim().slice(0, 80) || null,
        href: element.href || null,
        role: element.getAttribute("role") || null,
        className: element.className || null,
    }));

    return results;

    console.log(results);
    return results;
}

function clickElement(elementData) {
    let element = null;

    if (elementData.id) {
        element = document.getElementById(elementData.id);

    } else if (elementData.href) {
        element = [...document.querySelectorAll("a")].find((a) => a.href === elementData.href);

    } else if (elementData.text) {
        const candidates = document.querySelectorAll(elementData.tag || "*");
        element = [...candidates].find((c) => c.innerText?.trim().slice(0, 80) === elementData.text);

    } else if (elementData.tag) {
        element = document.querySelector(elementData.tag);
    }

    if (!element) {
        console.log("could not find element", elementData);
        return false;
    }

    element.focus();
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.click();
    console.log("click", element);
    return true;
}

function fillInput(elementData, text) {
    let element = null;
    if (elementData.id) {
        element = document.getElementById(elementData.id);
    } else if (!element && elementData.role) {
        element = document.querySelector(`[role="${elementData.role}"]`);
    } else if (!element && elementData.className) {
        const selector = `${elementData.tag || ""}[class="${elementData.className}"]`;
        element = document.querySelector(selector);
    } else if (!element && elementData.tag) {
        element = document.querySelector(elementData.tag);
    } else if (!element) {
        console.log("could not find element", elementData);
        return false;
    }

    element.focus();

    if (element.isContentEditable) {
        element.innerText = text;
    } else {
        element.value = text;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    console.log("fill", element);
    return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getDOM") {
        sendResponse({ dom: document.documentElement.outerHTML });
    }
    else if (request.action === "clickFirstResult") {
        const result = clickFirstSearchResult();
        sendResponse(result);
    }
    else if (request.action === "listResults") {
        const result = listSearchResults();
        sendResponse(result);
    }
    else if (request.action === "listPicrossKeys") {
        const result = listPicrossKeys();
        sendResponse(result);
    }
    else if (request.action === "listPicrossSquares") {
        const result = listPicrossSquares();
        sendResponse(result);
    }
    else if (request.action === "clickPicrossElement") {
        const result = clickPicrossElement(request.x, request.y);
        sendResponse(result);
    } 
    else if (request.action === "listClickableElements") {
        const result = listClickableElements();
        sendResponse(result);
    }
    else if (request.action === "clickElement") {
        const result = clickElement(request.elementData);
        sendResponse(result);
    }
    else if (request.action === "fillInput") {
        const result = fillInput(request.elementData, request.text);
        sendResponse(result);
    }
    return true;
})

