// The raw data may be requested without TLS, but the user-facing stuff really shouldn't.
if (location.host == "browse.wf" && location.protocol == "http:")
{
	location.protocol = "https:";
}

// Disable navbar links that point back to this page.
document.querySelectorAll(".navbar-nav .nav-link.active, .navbar-nav .dropdown-item.active").forEach(elm =>
{
	elm.onclick = (event) => { event.preventDefault() };
});

// Localisation

function getDictPromise()
{
	return fetch("warframe-public-export-plus/dict." + (localStorage.getItem("lang") ?? "en") + ".json").then(res => res.json());
}

function getOSDictPromise()
{
	return fetch("https://oracle.browse.wf/dicts/" + (localStorage.getItem("lang") ?? "en") + ".json?" + OS_DICT_VERSION).then(res => res.json());
}

function setLanguage(code)
{
	setLanguageIndicator(code);
	localStorage.setItem("lang", code);
	// Trigger cloud sync if available
	if (window.triggerCloudSync)
	{
		window.triggerCloudSync();
	}
	const promises = [];
	if (window.dict)
	{
		promises.push(getDictPromise().then(dict => { window.dict = dict; }));
	}
	if (window.osdict)
	{
		promises.push(getOSDictPromise().then(osdict => { window.osdict = osdict; }));
	}
	if ("onLanguageUpdate" in window)
	{
		Promise.all(promises).then(() => { onLanguageUpdate(); });
	}
}

function setLanguageIndicator(code)
{
	document.querySelectorAll(".dropdown-item[data-lang]").forEach(elm => elm.classList.remove("active"));
	const item = document.querySelector(".dropdown-item[data-lang=" + code + "]");
	item.classList.add("active");
	document.getElementById("lang-dropdown").textContent = item.textContent;
}

if (localStorage.getItem("lang"))
{
	setLanguageIndicator(localStorage.getItem("lang"));
}

function toTitleCase(str)
{
	return str.replace(/[^\s\-]+/g, word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase());
}

// Images

function setImageSource(img, icon)
{
	img.loading = "lazy";
	if (ExportImages[icon]?.forumName)
	{
		img.src = "https://media.invisioncic.com/Mwarframe/pages_media/" + ExportImages[icon].forumName + ".png";
	}
	else if (ExportImages[icon]?.contentHash)
	{
		img.src = "https://content.warframe.com/PublicExport" + icon + "!" + ExportImages[icon].contentHash;
	}
	else
	{
		img.src = "https://browse.wf" + icon;
	}
}

// Text icons

function resolveTextIcons(text)
{
	return text.replaceAll(/<[^>]+>/g, (match) => {
		const name = match.split("<").join("").split(">").join("");
		if (ExportTextIcons[name]?.DIT_AUTO)
		{
			return "<img alt='<" + name + ">' style='height:1em;position:relative;bottom:2px' src='https://browse.wf" + ExportTextIcons[name].DIT_AUTO + "' />";
		}
		//console.warn("Failed to resolve text icon:", name);
		return "&lt;" + name + "&gt;";
	});
}

// Navbar fixed toggle

function updateNavbarPinAppearance()
{
	const isFixed = !localStorage.getItem("navbar.unfixed");
	const navbar = document.getElementById("main-navbar");
	const spacer = document.getElementById("navbar-spacer");
	const pinMobile = document.getElementById("navbar-pin-mobile");
	const pinDesktop = document.getElementById("navbar-pin-desktop");

	const tooltipText = isFixed ? "Unfix navbar from the top" : "Fix navbar to the top";

	if (isFixed)
	{
		navbar.classList.add("fixed-top");
		spacer.style.height = "56px";
		pinMobile.classList.remove("navbar-pin-unfixed");
		pinDesktop.classList.remove("navbar-pin-unfixed");
	}
	else
	{
		navbar.classList.remove("fixed-top");
		spacer.style.height = "0";
		pinMobile.classList.add("navbar-pin-unfixed");
		pinDesktop.classList.add("navbar-pin-unfixed");
	}

	// Update tooltips if Bootstrap is loaded
	if (window.bootstrap && window.bootstrap.Tooltip)
	{
		const tooltipMobile = window.bootstrap.Tooltip.getInstance(pinMobile);
		if (tooltipMobile)
		{
			tooltipMobile.dispose();
		}
		pinMobile.setAttribute("data-bs-title", tooltipText);
		new window.bootstrap.Tooltip(pinMobile);

		const tooltipDesktop = window.bootstrap.Tooltip.getInstance(pinDesktop);
		if (tooltipDesktop)
		{
			tooltipDesktop.dispose();
		}
		pinDesktop.setAttribute("data-bs-title", tooltipText);
		new window.bootstrap.Tooltip(pinDesktop);
	}
}

function toggleNavbarFixed()
{
	if (localStorage.getItem("navbar.unfixed"))
	{
		localStorage.removeItem("navbar.unfixed");
	}
	else
	{
		localStorage.setItem("navbar.unfixed", "1");
	}
	updateNavbarPinAppearance();
}

// Initialize navbar pin state on page load
if (document.getElementById("main-navbar"))
{
	// Wait for DOM to be fully loaded
	if (document.readyState === "loading")
	{
		document.addEventListener("DOMContentLoaded", updateNavbarPinAppearance);
	}
	else
	{
		updateNavbarPinAppearance();
	}
}
