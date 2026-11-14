/**
 Creates a 24px inline icon for an export icon path. Requires `window.ExportImages` to be loaded first.
 */
export function makeIcon(iconPath) {
    const img = document.createElement('img');
    img.style.height = '24px';
    img.style.width = '24px';
    img.style.objectFit = 'contain';
    img.alt = '';
    setImageSource(img, iconPath);
    return img;
}
//# sourceMappingURL=icon-helpers.js.map