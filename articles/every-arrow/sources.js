/* Every Arrow Is a Decision — the source registry.
 *
 * Build-time only (scripts/every_arrow/build.mjs). Every inline citation in the
 * essay carries data-src="<key>"; the build fails if a key is missing here or a
 * source here is never cited, and it writes the Sources list from this file.
 * Group: where the entry is listed. kind: the label shown next to it.
 */
(function (root) {
  'use strict';
  var S = {
    /* Re-identification and inference */
    sweeney00: { g: 'Re-identification, linkability and inference', c: 'Latanya Sweeney, “Simple Demographics Often Identify People Uniquely”, Carnegie Mellon University, Data Privacy Working Paper 3, 2000. An estimate of uniqueness from 1990 census data.', u: 'https://dataprivacylab.org/projects/identifiability/paper1.pdf' },
    golle06: { g: 'Re-identification, linkability and inference', c: 'Philippe Golle, “Revisiting the Uniqueness of Simple Demographics in the US Population”, ACM Workshop on Privacy in the Electronic Society, 2006 (about 63% on 2000 census data).', u: 'https://crypto.stanford.edu/~pgolle/papers/census.pdf' },
    aol06: { g: 'Re-identification, linkability and inference', c: 'Michael Barbaro and Tom Zeller Jr., “A Face Is Exposed for AOL Searcher No. 4417749”, The New York Times, 9 August 2006.', u: 'https://www.nytimes.com/2006/08/09/technology/09aol.html' },
    netflix08: { g: 'Re-identification, linkability and inference', c: 'Arvind Narayanan and Vitaly Shmatikov, “Robust De-anonymization of Large Sparse Datasets”, IEEE Symposium on Security and Privacy, 2008.', u: 'https://arxiv.org/abs/cs/0610105' },
    target12: { g: 'Re-identification, linkability and inference', c: 'Charles Duhigg, “How Companies Learn Your Secrets”, The New York Times Magazine, 16 February 2012. The father anecdote is from an unnamed source.', u: 'https://www.nytimes.com/2012/02/19/magazine/shopping-habits.html' },
    strava18: { g: 'Re-identification, linkability and inference', c: 'Alex Hern, “Fitness tracking app Strava gives away location of secret US army bases”, The Guardian, 28 January 2018.', u: 'https://www.theguardian.com/world/2018/jan/28/fitness-tracking-app-gives-away-location-of-secret-us-army-bases' },
    fbca18: { g: 'Re-identification, linkability and inference', c: 'Mike Schroepfer, “An Update on Our Plans to Restrict Data Access on Facebook”, Meta Newsroom, 4 April 2018 (“up to 87 million people”).', u: 'https://about.fb.com/news/2018/04/restricting-data-access/' },
    ftcca19: { g: 'Re-identification, linkability and inference', c: 'US Federal Trade Commission, “FTC Issues Opinion and Order Against Cambridge Analytica For Deceiving Consumers About the Collection of Facebook Data”, 6 December 2019.', u: 'https://www.ftc.gov/news-events/news/press-releases/2019/12/ftc-issues-opinion-order-against-cambridge-analytica-deceiving-consumers-about-collection-facebook' },
    /* Documents and history */
    gdocs: { g: 'Documents, history and redaction', c: 'Google Docs Editors Help, “Find what’s changed in a file” (version history; who can see it; deleting versions on Workspace editions).', u: 'https://support.google.com/docs/answer/190843' },
    gtrash: { g: 'Documents, history and redaction', c: 'Google Drive Help, “Delete and restore files in Google Drive” (trash emptied after 30 days).', u: 'https://support.google.com/drive/answer/2375102' },
    dossier03: { g: 'Documents, history and redaction', c: 'Richard M. Smith, “Microsoft Word bytes Tony Blair in the butt”, 2003 — the revision log of the UK’s February 2003 Iraq dossier (archived copy).', u: 'https://web.archive.org/web/2003/http://www.computerbytesman.com/privacy/blair.htm' },
    manafort19: { g: 'Documents, history and redaction', c: 'Zoe Tillman, BuzzFeed News, 8 January 2019, on the improperly redacted filing in United States v. Manafort, 1:17-cr-201 (D.D.C.) (archived copy).', u: 'https://web.archive.org/web/2019/https://www.buzzfeednews.com/article/zoetillman/paul-manafort-redacted-konstanin-kilimnik-lying' },
    /* Accuracy and automated decisions */
    robodebt23: { g: 'Accuracy and automated decisions', c: 'Royal Commission into the Robodebt Scheme, Report, 7 July 2023.', u: 'https://robodebt.royalcommission.gov.au/publications/report' },
    dutch21: { g: 'Accuracy and automated decisions', c: 'Autoriteit Persoonsgegevens, “Tax Administration fined for discriminatory and unlawful data processing”, 7 December 2021.', u: 'https://www.autoriteitpersoonsgegevens.nl/en/current/tax-administration-fined-for-discriminatory-and-unlawful-data-processing' },
    transunion23: { g: 'Accuracy and automated decisions', c: 'US Federal Trade Commission, “FTC and CFPB Settlement to Require Trans Union to Pay $15 Million Over Charges It Failed to Ensure Accuracy of Tenant Screening Reports”, 12 October 2023.', u: 'https://www.ftc.gov/news-events/news/press-releases/2023/10/ftc-cfpb-settlement-require-trans-union-pay-15-million-over-charges-it-failed-ensure-accuracy-tenant' },
    fcra: { g: 'Accuracy and automated decisions', c: 'Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq., § 1681e(b) (accuracy).', u: 'https://www.ftc.gov/legal-library/browse/statutes/fair-credit-reporting-act' },
    /* Enforcement: flows, health, location, purpose */
    goodrx23: { g: 'Enforcement: flows, health, location and purpose', c: 'US Federal Trade Commission, “FTC Enforcement Action to Bar GoodRx from Sharing Consumers’ Sensitive Health Info for Advertising”, 1 February 2023.', u: 'https://www.ftc.gov/news-events/news/press-releases/2023/02/ftc-enforcement-action-bar-goodrx-sharing-consumers-sensitive-health-info-advertising' },
    betterhelp23: { g: 'Enforcement: flows, health, location and purpose', c: 'US Federal Trade Commission, “FTC Gives Final Approval to Order Banning BetterHelp from Sharing Sensitive Health Data for Advertising”, 14 July 2023.', u: 'https://www.ftc.gov/news-events/news/press-releases/2023/07/ftc-gives-final-approval-order-banning-betterhelp-sharing-sensitive-health-data-advertising' },
    kochava26: { g: 'Enforcement: flows, health, location and purpose', c: 'US Federal Trade Commission, on the stipulated order settling FTC v. Kochava (filed 2022), May 2026.', u: 'https://www.ftc.gov/news-events/news/press-releases/2026/05/ftc-ban-kochava-subsidiary-selling-sensitive-location-data-settle-charges-they-sold-location-data' },
    xmode24: { g: 'Enforcement: flows, health, location and purpose', c: 'US Federal Trade Commission, “FTC Order Prohibits Data Broker X-Mode Social and Outlogic from Selling Sensitive Location Data”, 9 January 2024.', u: 'https://www.ftc.gov/news-events/news/press-releases/2024/01/ftc-order-prohibits-data-broker-x-mode-social-outlogic-selling-sensitive-location-data' },
    flo21: { g: 'Enforcement: flows, health, location and purpose', c: 'US Federal Trade Commission, “FTC Finalizes Order with Flo Health”, June 2021.', u: 'https://www.ftc.gov/news-events/news/press-releases/2021/06/ftc-finalizes-order-flo-health-fertility-tracking-app-shared-sensitive-health-data-facebook-google' },
    twitter22: { g: 'Enforcement: flows, health, location and purpose', c: 'US Federal Trade Commission, “FTC Charges Twitter with Deceptively Using Account Security Data to Sell Targeted Ads”, 25 May 2022.', u: 'https://www.ftc.gov/news-events/news/press-releases/2022/05/ftc-charges-twitter-deceptively-using-account-security-data-sell-targeted-ads' },
    hbnr24: { g: 'Enforcement: flows, health, location and purpose', c: 'US Federal Trade Commission, “FTC Finalizes Changes to the Health Breach Notification Rule”, 26 April 2024 (effective 29 July 2024).', u: 'https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule' },
    /* Sensitive contexts */
    epic22: { g: 'Sensitive contexts', c: 'US Federal Trade Commission, “Fortnite Video Game Maker Epic Games to Pay More Than Half a Billion Dollars over FTC Allegations”, 19 December 2022.', u: 'https://www.ftc.gov/news-events/news/press-releases/2022/12/fortnite-video-game-maker-epic-games-pay-more-half-billion-dollars-over-ftc-allegations' },
    coppa25: { g: 'Sensitive contexts', c: 'US Federal Trade Commission, COPPA Rule amendments, 16 CFR Part 312 (published April 2025; effective 23 June 2025).', u: 'https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments' },
    clearview24: { g: 'Sensitive contexts', c: 'Autoriteit Persoonsgegevens, “Dutch DPA imposes a fine on Clearview because of illegal data collection for facial recognition”, 3 September 2024.', u: 'https://www.autoriteitpersoonsgegevens.nl/en/current/dutch-dpa-imposes-a-fine-on-clearview-because-of-illegal-data-collection-for-facial-recognition' },
    bipa: { g: 'Sensitive contexts', c: 'Illinois Biometric Information Privacy Act, 740 ILCS 14 (amended 2024).', u: 'https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004&ChapterID=57' },
    hm20: { g: 'Sensitive contexts', c: 'European Data Protection Board, “Hamburg Commissioner fines H&M 35.3 million euro for data protection violations in service centre”, October 2020.', u: 'https://edpb.europa.eu/news/national-news/2020/hamburg-commissioner-fines-hm-353-million-euro-data-protection-violations_it' },
    spyfone21: { g: 'Sensitive contexts', c: 'US Federal Trade Commission, “FTC Finalizes Order Banning Stalkerware Provider from Spyware Business”, December 2021.', u: 'https://www.ftc.gov/news-events/news/press-releases/2021/12/ftc-finalizes-order-banning-stalkerware-provider-spyware-business' },
    dult: { g: 'Sensitive contexts', c: 'Apple and Google, “Detecting Unwanted Location Trackers”, IETF Internet-Draft (DULT working group).', u: 'https://datatracker.ietf.org/doc/draft-ledvina-apple-google-unwanted-trackers/' },
    /* Consent and asking */
    idvd: { g: 'Consent and asking', c: 'Mike Evangelist’s first-person account of the iDVD “Burn” whiteboard, The Guardian, January 2006; retold in Greg McKeown, Effortless (2021). One participant’s recollection.', u: null },
    flurry21: { g: 'Consent and asking', c: 'Flurry Analytics, “iOS 14.5 Opt-in Rate — Daily Updates Since Launch”, 2021 (measures differ by method and date).', u: 'https://www.flurry.com/blog/att-opt-in-rate-monthly-updates/' },
    attfr25: { g: 'Consent and asking', c: 'Autorité de la concurrence, “Targeted advertising: the Autorité imposes a fine of €150,000,000 on Apple”, 31 March 2025.', u: 'https://www.autoritedelaconcurrence.fr/en/press-release/targeted-advertising-autorite-de-la-concurrence-imposes-fine-eu150000000-apple' },
    attit25: { g: 'Consent and asking', c: 'Autorità Garante della Concorrenza e del Mercato, case A561 (Apple App Tracking Transparency), December 2025.', u: 'https://en.agcm.it/en/media/press-releases/2025/12/A561' },
    attde26: { g: 'Consent and asking', c: 'Bundeskartellamt, Apple App Tracking Transparency proceeding closed with commitments, 17 August 2026.', u: 'https://www.bundeskartellamt.de/SharedDocs/Meldung/EN/Pressemitteilungen/2026/08_17_2026_Apple_ATTF.html' },
    nissenbaum04: { g: 'Consent and asking', c: 'Helen Nissenbaum, “Privacy as Contextual Integrity”, Washington Law Review 79 (2004) 119; and Privacy in Context (Stanford University Press, 2010).', u: 'https://digitalcommons.law.uw.edu/wlr/vol79/iss1/10/' },
    /* Law and frameworks */
    gdpr: { g: 'Law, standards and frameworks', c: 'Regulation (EU) 2016/679 (General Data Protection Regulation), Arts. 5, 8, 12–22, 28, 33–35 and Chapter V.', u: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
    sccs: { g: 'Law, standards and frameworks', c: 'Commission Implementing Decision (EU) 2021/914 on standard contractual clauses.', u: 'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj' },
    latombe: { g: 'Law, standards and frameworks', c: 'General Court, Latombe v Commission, T-553/23, 3 September 2025 (EU–US Data Privacy Framework upheld; under appeal).', u: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A62023TJ0553' },
    edpb: { g: 'Law, standards and frameworks', c: 'European Data Protection Board, Guidelines 9/2022 on personal data breach notification under GDPR, version 2.0, 2023.', u: 'https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-92022-personal-data-breach-notification-under_en' },
    cppa: { g: 'Law, standards and frameworks', c: 'California Privacy Protection Agency, CCPA regulations.', u: 'https://cppa.ca.gov/regulations/' },
    cppaadmt: { g: 'Law, standards and frameworks', c: 'California Privacy Protection Agency, approval of regulations on automated decision-making technology, risk assessments and cybersecurity audits, 23 September 2025.', u: 'https://cppa.ca.gov/announcements/2025/20250923.html' },
    hipaa: { g: 'Law, standards and frameworks', c: 'US Department of Health and Human Services, HIPAA Breach Notification Rule, 45 CFR 164.400–414.', u: 'https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html' },
    aiact: { g: 'Law, standards and frameworks', c: 'Regulation (EU) 2024/1689 (Artificial Intelligence Act), Art. 14 (human oversight of high-risk systems).', u: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng' },
    linddun: { g: 'Law, standards and frameworks', c: 'LINDDUN privacy threat modeling framework, DistriNet, KU Leuven — threat types.', u: 'https://linddun.org/threat-types/' },
    openlineage: { g: 'Law, standards and frameworks', c: 'OpenLineage specification (LF AI & Data), object model.', u: 'https://openlineage.io/docs/spec/object-model' },
    nist80088: { g: 'Law, standards and frameworks', c: 'NIST SP 800-88 Revision 2, Guidelines for Media Sanitization, September 2025 (cryptographic erase).', u: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-88r2.pdf' },
    /* Authentication */
    webauthn3: { g: 'Authentication', c: 'W3C, Web Authentication: An API for accessing Public Key Credentials, Level 3.', u: 'https://www.w3.org/TR/webauthn-3/' },
    fido: { g: 'Authentication', c: 'FIDO Alliance, Passkeys.', u: 'https://fidoalliance.org/passkeys/' },
    nist63b4: { g: 'Authentication', c: 'NIST SP 800-63B-4, Digital Identity Guidelines: Authentication and Authenticator Management, 2025.', u: 'https://csrc.nist.gov/pubs/sp/800/63/b/4/final' },
    cisanm: { g: 'Authentication', c: 'CISA, “Implementing Number Matching in MFA Applications”, fact sheet, October 2022.', u: 'https://www.cisa.gov/sites/default/files/publications/fact-sheet-implement-number-matching-in-mfa-applications-508c.pdf' },
    /* AI and ML */
    carlini21: { g: 'AI and machine learning', c: 'Nicholas Carlini et al., “Extracting Training Data from Large Language Models”, USENIX Security Symposium, 2021.', u: 'https://www.usenix.org/conference/usenixsecurity21/presentation/carlini-extracting' },
    carlini23: { g: 'AI and machine learning', c: 'Nicholas Carlini et al., “Quantifying Memorization Across Neural Language Models”, ICLR 2023.', u: 'https://openreview.net/pdf?id=TatRHT_1cK' },
    nasr23: { g: 'AI and machine learning', c: 'Milad Nasr et al., “Scalable Extraction of Training Data from (Production) Language Models”, 2023.', u: 'https://arxiv.org/abs/2311.17035' },
    shokri17: { g: 'AI and machine learning', c: 'Reza Shokri et al., “Membership Inference Attacks Against Machine Learning Models”, IEEE Symposium on Security and Privacy, 2017.', u: 'https://arxiv.org/abs/1610.05820' },
    morris23: { g: 'AI and machine learning', c: 'John X. Morris et al., “Text Embeddings Reveal (Almost) As Much As Text”, EMNLP 2023.', u: 'https://aclanthology.org/2023.emnlp-main.765/' },
    bourtoule21: { g: 'AI and machine learning', c: 'Lucas Bourtoule et al., “Machine Unlearning”, IEEE Symposium on Security and Privacy, 2021.', u: 'https://arxiv.org/abs/1912.03817' },
    cooper24: { g: 'AI and machine learning', c: 'A. Feder Cooper et al., “Machine Unlearning Doesn’t Do What You Think”, 2024.', u: 'https://arxiv.org/abs/2412.06966' },
    owasp: { g: 'AI and machine learning', c: 'OWASP, Top 10 for LLM Applications 2025 (LLM02 Sensitive Information Disclosure, LLM06 Excessive Agency, LLM08 Vector and Embedding Weaknesses).', u: 'https://genai.owasp.org/llm-top-10/' },
    nistairmf: { g: 'AI and machine learning', c: 'NIST AI 100-1, Artificial Intelligence Risk Management Framework 1.0, January 2023.', u: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf' },
    nist600: { g: 'AI and machine learning', c: 'NIST AI 600-1, Generative Artificial Intelligence Profile, July 2024.', u: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf' },
    /* Differential privacy */
    dwork14: { g: 'Differential privacy', c: 'Cynthia Dwork and Aaron Roth, The Algorithmic Foundations of Differential Privacy, 2014 (basic and advanced composition).', u: 'https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf' },
    rdp: { g: 'Differential privacy', c: 'Ilya Mironov, “Rényi Differential Privacy”, IEEE CSF, 2017.', u: 'https://arxiv.org/abs/1702.07476' },
    zcdp: { g: 'Differential privacy', c: 'Mark Bun and Thomas Steinke, “Concentrated Differential Privacy: Simplifications, Extensions, and Lower Bounds”, TCC 2016.', u: 'https://arxiv.org/abs/1605.02065' },
    census21: { g: 'Differential privacy', c: 'US Census Bureau, “Census Bureau Sets Key Parameters to Protect Privacy in 2020 Census Results”, 9 June 2021.', u: 'https://www.census.gov/newsroom/press-releases/2021/2020-census-key-parameters.html' }
  };
  root.EA_SOURCES = S;
})(typeof window !== 'undefined' ? window : globalThis);
