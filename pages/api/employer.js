import axios from "axios";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import jschardet from "jschardet";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const company = String(req.query.company || "").toLowerCase();
    const map = {
      caplogy: "https://www.societe.com/societe/caplogy-893395608.html",
      novatiel: "https://www.societe.com/societe/novatiel-developpement-932191182.html",
      doctrina: "https://www.societe.com/societe/doctrina-948465844.html",
    };

    if (!map[company]) {
      return res.status(400).json({ error: "company invalide" });
    }

    const url = map[company];
    const entreprise = await scrapeSociete(url);

    const representant = entreprise.dirigeants?.[0]?.nom || "";
    const fonction = entreprise.dirigeants?.[0]?.fonction || "";

    return res.status(200).json({
      employer: {
        denomination: entreprise.nom || "",
        siren: cleanDigits(entreprise.siren, 9),
        siret: cleanDigits(entreprise.siret, 14),
        rcs: entreprise.formeJuridique || "",
        adresse: entreprise.adresse || "",
        representant,
        fonction_representant: fonction,
      },
      source: "societe.com",
    });
  } catch (error) {
    return res.status(200).json({
      employer: {},
      error: error?.message || "Erreur scraping",
    });
  }
}

async function scrapeSociete(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
    timeout: 8000,
  });

  const detectedEncoding = jschardet.detect(response.data).encoding;
  const decodedData = iconv.decode(response.data, detectedEncoding || "utf-8");
  const $ = cheerio.load(decodedData);

  const entreprise = {
    nom: $("#identite h1").text().trim(),
    statut: $("#identite .ui-tag").first().text().trim(),
    siren: $("template[data-copy-id=\"resume_siren\"]").text().trim(),
    siret: $("template[data-copy-id=\"resume_siret\"]").text().trim(),
    tva: $("template[data-copy-id=\"resume_tva\"]").text().trim(),
    dateCreation: $("#identite dt:contains(\"DATE DE CREATION\")").next("dd").text().trim(),
    activite: $("#identite dt:contains(\"ACTIVIT?\")").next("dd").contents().first().text().trim(),
    formeJuridique: $("#identite dt:contains(\"FORME JURIDIQUE\")").next("dd").contents().first().text().trim(),
    adresse: $("template[data-copy-id=\"resume_company_address\"]").text().trim(),
    capitalSocial: $("template[data-copy-id=\"legal_capital\"]").text().trim() + " €",
    conventionCollective: $("#__activity dt:contains(\"Convention collective\")").next("dd").contents().first().text().trim(),
    effectif: $(".co-summary-board li:contains(\"Taille\") .ui-tag").text().trim(),
    dirigeants: [],
    etablissements: [],
    finances: {},
    scores: {
      extraFinancier: $("#coScoreTotal").text().trim() || "N/A",
      souverainete: $(".ui-score-badge .ui-score").text().trim() || "N/A",
    },
  };

  $("li.ui-mandats[data-managers-status=\"active\"] li.ui-mandat").each((i, el) => {
    const nom = $(el).find(".ui-label").text().trim();

    // La fonction est dans le 2e <p> (le 1er contient souvent la naissance)
    const fonctionElement = $(el).find("p").eq(1).length ? $(el).find("p").eq(1) : $(el).find("p").first();
    let fonction = fonctionElement
      .contents()
      .filter(function () {
        return this.nodeType === 3;
      })
      .text()
      .trim();

    // Retirer la partie "Depuis ..." si pr?sente
    fonction = fonction.split(/\s+depuis\s+/i)[0].trim();

    if (nom) {
      entreprise.dirigeants.push({ nom, fonction });
    }
  });

  $("li.ui-mandats[data-establishments-status=\"active\"] li.ui-mandat").each((i, el) => {
    const siret = $(el).find(".xDpID").text().trim();
    if (siret) {
      entreprise.etablissements.push({
        siret,
        type: $(el).find("strong").text().trim(),
        statut: "Ouvert",
      });
    }
  });

  const getFinanceVal = (type, yearIndex) => {
    return $("li[data-type=\"" + type + "\"] div[data-year]").eq(yearIndex).text().trim();
  };

  const anneeA = $("#coBalancesYearA option:selected").val();
  const anneeB = $("#coBalancesYearB option:selected").val();

  if (anneeA) {
    entreprise.finances["annee" + anneeA] = {
      resultatNet: getFinanceVal("netIncome", 0),
      tresorerie: getFinanceVal("cashFlow", 0),
      rentabilite: getFinanceVal("profitability", 0),
      dettes: getFinanceVal("deptsOver1Year", 0),
    };
  }
  if (anneeB) {
    entreprise.finances["annee" + anneeB] = {
      resultatNet: getFinanceVal("netIncome", 1),
      tresorerie: getFinanceVal("cashFlow", 1),
      rentabilite: getFinanceVal("profitability", 1),
      dettes: getFinanceVal("deptsOver1Year", 1),
    };
  }

  return entreprise;
}

function cleanDigits(value, max) {
  const v = String(value || "").replace(/\D/g, "");
  return max ? v.slice(0, max) : v;
}