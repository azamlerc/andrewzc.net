(async function main() {
  const params    = new URLSearchParams(location.search);
  const artistKey = (params.get("artist") || params.get("key") || params.get("id") || params.get("name") || "").trim();

  const headlineEl = document.getElementById("headline");
  const captionEl  = document.getElementById("caption");

  if (!artistKey) {
    document.title         = "Missing artist";
    headlineEl.textContent = "Missing artist";
    captionEl.textContent  = "Use ?artist=pink-floyd";
    return;
  }

  try {
    const { pages, data } = await Results.fetchPagesAndData(
      `${Results.API_BASE}/artists/${encodeURIComponent(artistKey)}`
    );

    const artist = data.artist || null;

    if (!artist) throw new Error(`Missing artist entity for ${artistKey}`);

    const artistName = artist.name || UI.titleCase(artistKey.replace(/-/g, " "));
    const entities   = Results.withPageIcons(data.entities || [], pages).map((entity) => ({
      ...entity,
      reference: entity.reference === artistName ? null : entity.reference,
    }));
    const artistPages = (pages || []).map((page) => ({
      ...page,
      name: String(page?.name || "").replace(/^Music\s+/, "") || page?.name || page?.key,
    }));

    Results.renderHeader(headlineEl, captionEl, {
      name:  artistName,
      icons: artist.icons,
      been:  null,
    });

    if (artist.link) {
      captionEl.appendChild(document.createTextNode("🌍 "));
      captionEl.appendChild(UI.el("a", { href: artist.link, target: "_blank", rel: "noopener noreferrer" }, document.createTextNode("Wikipedia")));
      captionEl.appendChild(UI.br());
    }

    captionEl.appendChild(UI.smallSpace());

    const byList = Results.bucketByList(entities);
    const any    = Results.renderSections(captionEl, artistPages, byList, {
      pageName: artistName,
      sort: "alphabetical",
    });

    if (!any) Results.renderEmpty(captionEl);
    await Results.enableAdminControls({ headlineEl, storageKey: `artist:${artistKey}`, infoPageId: "artists" });

  } catch (err) {
    Results.renderError(headlineEl, captionEl, err);
  }
})();
