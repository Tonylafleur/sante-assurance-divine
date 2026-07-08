"""
Base de codes CIM-10 (ICD-10) pertinents pour le contexte camerounais.
Inclut les maladies endémiques, maladies tropicales, et pathologies fréquentes.
Source: OMS CIM-10 Version 2019
"""
from fastapi import APIRouter, Query
from typing import List

router = APIRouter(prefix="/cim10", tags=["CIM-10"])

# Base de données CIM-10 — codes pertinents pour le Cameroun
CIM10_DB = [
    # ─── MALADIES INFECTIEUSES ET PARASITAIRES ───
    {"code": "A00", "libelle": "Choléra"},
    {"code": "A00.0", "libelle": "Choléra dû à Vibrio cholerae 01, biovar cholerae"},
    {"code": "A00.1", "libelle": "Choléra dû à Vibrio cholerae 01, biovar El Tor"},
    {"code": "A01", "libelle": "Fièvre typhoïde et paratyphoïde"},
    {"code": "A01.0", "libelle": "Fièvre typhoïde"},
    {"code": "A01.1", "libelle": "Fièvre paratyphoïde A"},
    {"code": "A02", "libelle": "Autres infections à Salmonella"},
    {"code": "A03", "libelle": "Shigellose (Dysenterie bacillaire)"},
    {"code": "A04.0", "libelle": "Infection à Escherichia coli entéropathogène"},
    {"code": "A06", "libelle": "Amibiase"},
    {"code": "A06.0", "libelle": "Dysenterie amibienne aiguë"},
    {"code": "A06.1", "libelle": "Amibiase intestinale chronique"},
    {"code": "A06.4", "libelle": "Abcès amibien du foie"},
    {"code": "A07.1", "libelle": "Giardiase (lambliase)"},
    {"code": "A09", "libelle": "Diarrhée et gastro-entérite d'origine infectieuse présumée"},
    {"code": "A15", "libelle": "Tuberculose respiratoire, confirmée bactériologiquement"},
    {"code": "A15.0", "libelle": "Tuberculose pulmonaire — BAAR positif"},
    {"code": "A15.1", "libelle": "Tuberculose pulmonaire — culture positive uniquement"},
    {"code": "A15.3", "libelle": "Tuberculose pulmonaire confirmée par voies non précisées"},
    {"code": "A16", "libelle": "Tuberculose respiratoire, non confirmée bactériologiquement"},
    {"code": "A16.0", "libelle": "Tuberculose pulmonaire — BAAR et culture négatifs"},
    {"code": "A16.2", "libelle": "Tuberculose pulmonaire sans mention de confirmation bact."},
    {"code": "A17.0", "libelle": "Méningite tuberculeuse"},
    {"code": "A18.0", "libelle": "Tuberculose des os et articulations"},
    {"code": "A18.1", "libelle": "Tuberculose du système génito-urinaire"},
    {"code": "A18.2", "libelle": "Adénopathie tuberculeuse périphérique"},
    {"code": "A19", "libelle": "Tuberculose miliaire"},
    {"code": "A20", "libelle": "Peste"},
    {"code": "A22", "libelle": "Charbon (anthrax)"},
    {"code": "A30", "libelle": "Lèpre (maladie de Hansen)"},
    {"code": "A36", "libelle": "Diphtérie"},
    {"code": "A37", "libelle": "Coqueluche"},
    {"code": "A38", "libelle": "Scarlatine"},
    {"code": "A39", "libelle": "Infection à méningocoque"},
    {"code": "A40", "libelle": "Septicémie à streptocoque"},
    {"code": "A41", "libelle": "Autres septicémies"},
    {"code": "A41.9", "libelle": "Septicémie, sans précision"},
    {"code": "A46", "libelle": "Érysipèle"},
    {"code": "A49.0", "libelle": "Infection à staphylocoque, sans précision"},
    {"code": "A50", "libelle": "Syphilis congénitale"},
    {"code": "A51", "libelle": "Syphilis précoce"},
    {"code": "A53.9", "libelle": "Syphilis, sans précision"},
    {"code": "A54", "libelle": "Gonococcie"},
    {"code": "A57", "libelle": "Chancre mou (chancroïde)"},
    {"code": "A59", "libelle": "Trichomonase"},
    {"code": "A63.0", "libelle": "Condylomes acuminés (verrues génitales)"},
    {"code": "A64", "libelle": "Maladies sexuellement transmissibles, sans précision"},
    {"code": "A75", "libelle": "Typhus"},
    {"code": "A77", "libelle": "Fièvres maculées (rickettsioses)"},
    {"code": "A82", "libelle": "Rage"},
    {"code": "A82.0", "libelle": "Rage sauvage (rage forestière)"},
    {"code": "A82.1", "libelle": "Rage urbaine"},
    {"code": "A83", "libelle": "Encéphalite à arbovirus"},
    {"code": "A87", "libelle": "Méningite virale"},
    {"code": "A90", "libelle": "Dengue (fièvre dengue classique)"},
    {"code": "A91", "libelle": "Dengue hémorragique"},
    {"code": "A92.0", "libelle": "Infection à virus Chikungunya"},
    {"code": "A95", "libelle": "Fièvre jaune"},
    {"code": "A96.2", "libelle": "Fièvre de Lassa"},
    {"code": "A98.3", "libelle": "Maladie à virus Marburg"},
    {"code": "A98.4", "libelle": "Maladie à virus Ebola"},

    # ─── VIH / SIDA ───
    {"code": "B20", "libelle": "Maladie à VIH entraînant des maladies infectieuses et parasitaires"},
    {"code": "B20.0", "libelle": "Maladie à VIH avec infections mycobactériennes (tuberculose)"},
    {"code": "B20.1", "libelle": "Maladie à VIH avec autres infections bactériennes"},
    {"code": "B20.3", "libelle": "Maladie à VIH avec pneumocystose"},
    {"code": "B20.6", "libelle": "Maladie à VIH avec pneumonie à Pneumocystis"},
    {"code": "B21", "libelle": "Maladie à VIH entraînant des tumeurs malignes"},
    {"code": "B22", "libelle": "Maladie à VIH entraînant d'autres affections précisées"},
    {"code": "B23", "libelle": "Maladie à VIH entraînant d'autres affections"},
    {"code": "B24", "libelle": "Maladie à VIH, sans précision (SIDA)"},

    # ─── PALUDISME ───
    {"code": "B50", "libelle": "Paludisme à Plasmodium falciparum"},
    {"code": "B50.0", "libelle": "Paludisme à P. falciparum avec complications cérébrales (neuropaludisme)"},
    {"code": "B50.8", "libelle": "Autres paludismes à P. falciparum graves et compliqués"},
    {"code": "B50.9", "libelle": "Paludisme à P. falciparum, sans précision (paludisme simple)"},
    {"code": "B51", "libelle": "Paludisme à Plasmodium vivax"},
    {"code": "B51.0", "libelle": "Paludisme à P. vivax avec rupture de la rate"},
    {"code": "B51.9", "libelle": "Paludisme à P. vivax, sans précision"},
    {"code": "B52", "libelle": "Paludisme à Plasmodium malariae"},
    {"code": "B53", "libelle": "Autres formes de paludisme confirmées parasitologiquement"},
    {"code": "B54", "libelle": "Paludisme, sans précision"},

    # ─── MALADIES PARASITAIRES ───
    {"code": "B65", "libelle": "Schistosomiase (bilharziose)"},
    {"code": "B65.1", "libelle": "Schistosomiase due à S. mansoni (bilharziose intestinale)"},
    {"code": "B65.2", "libelle": "Schistosomiase due à S. haematobium (bilharziose urinaire)"},
    {"code": "B69", "libelle": "Cysticercose"},
    {"code": "B70", "libelle": "Diphyllobothriase et sparganose"},
    {"code": "B71", "libelle": "Autres cestodoses"},
    {"code": "B72", "libelle": "Dracunculose (ver de Guinée)"},
    {"code": "B73", "libelle": "Onchocercose (cécité des rivières)"},
    {"code": "B74", "libelle": "Filarioses"},
    {"code": "B74.0", "libelle": "Filariose à Wuchereria bancrofti (éléphantiasis)"},
    {"code": "B74.3", "libelle": "Loase (filariose à Loa loa)"},
    {"code": "B76", "libelle": "Ankylostomose et nécatorose"},
    {"code": "B77", "libelle": "Ascaridiase (ascaris)"},
    {"code": "B79", "libelle": "Trichocéphalose (Trichuris trichiura)"},
    {"code": "B80", "libelle": "Oxyurose (entérobiose)"},
    {"code": "B85", "libelle": "Pédiculose et phtiriase"},
    {"code": "B86", "libelle": "Gale"},
    {"code": "B87", "libelle": "Myiase"},

    # ─── HÉPATITES VIRALES ───
    {"code": "B15", "libelle": "Hépatite A aiguë"},
    {"code": "B16", "libelle": "Hépatite B aiguë"},
    {"code": "B16.0", "libelle": "Hépatite B aiguë avec agent delta et coma hépatique"},
    {"code": "B16.9", "libelle": "Hépatite B aiguë sans agent delta et sans coma hépatique"},
    {"code": "B17.1", "libelle": "Hépatite C aiguë"},
    {"code": "B18", "libelle": "Hépatite virale chronique"},
    {"code": "B18.1", "libelle": "Hépatite B chronique sans agent delta"},
    {"code": "B18.2", "libelle": "Hépatite C chronique"},
    {"code": "B19", "libelle": "Hépatite virale, sans précision"},

    # ─── MALADIES ÉVITABLES PAR VACCINATION ───
    {"code": "B05", "libelle": "Rougeole"},
    {"code": "B05.0", "libelle": "Rougeole avec encéphalite"},
    {"code": "B05.2", "libelle": "Rougeole avec pneumonie"},
    {"code": "B05.4", "libelle": "Rougeole avec complications intestinales"},
    {"code": "B05.9", "libelle": "Rougeole sans complications"},
    {"code": "B06", "libelle": "Rubéole"},
    {"code": "B26", "libelle": "Oreillons"},
    {"code": "A35", "libelle": "Tétanos (non obstétrical)"},
    {"code": "A34", "libelle": "Tétanos obstétrical"},
    {"code": "A33", "libelle": "Tétanos néonatal"},

    # ─── MALADIES RESPIRATOIRES ───
    {"code": "J00", "libelle": "Rhinopharyngite aiguë (rhume)"},
    {"code": "J02", "libelle": "Pharyngite aiguë"},
    {"code": "J03", "libelle": "Amygdalite aiguë"},
    {"code": "J04", "libelle": "Laryngite et trachéite aiguës"},
    {"code": "J06.9", "libelle": "Infection aiguë des voies respiratoires supérieures, sans précision"},
    {"code": "J10", "libelle": "Grippe due à virus grippal identifié"},
    {"code": "J11", "libelle": "Grippe due à virus non identifié"},
    {"code": "J12", "libelle": "Pneumonie virale"},
    {"code": "J13", "libelle": "Pneumonie à pneumocoque"},
    {"code": "J14", "libelle": "Pneumonie à Haemophilus influenzae"},
    {"code": "J15", "libelle": "Pneumonie bactérienne"},
    {"code": "J15.0", "libelle": "Pneumonie à Klebsiella pneumoniae"},
    {"code": "J15.2", "libelle": "Pneumonie à staphylocoque"},
    {"code": "J18", "libelle": "Pneumonie à agent non précisé"},
    {"code": "J18.9", "libelle": "Pneumonie, sans précision"},
    {"code": "J20", "libelle": "Bronchite aiguë"},
    {"code": "J22", "libelle": "Infection aiguë des voies respiratoires inférieures, sans précision"},
    {"code": "J40", "libelle": "Bronchite, non précisée comme aiguë ou chronique"},
    {"code": "J45", "libelle": "Asthme"},
    {"code": "J45.0", "libelle": "Asthme à prédominance allergique"},
    {"code": "J45.1", "libelle": "Asthme non allergique"},
    {"code": "J45.9", "libelle": "Asthme, sans précision"},
    {"code": "J46", "libelle": "État de mal asthmatique"},

    # ─── MALADIES CARDIOVASCULAIRES ───
    {"code": "I10", "libelle": "Hypertension artérielle essentielle"},
    {"code": "I11", "libelle": "Cardiopathie hypertensive"},
    {"code": "I20", "libelle": "Angine de poitrine"},
    {"code": "I21", "libelle": "Infarctus aigu du myocarde"},
    {"code": "I25", "libelle": "Cardiopathie ischémique chronique"},
    {"code": "I26", "libelle": "Embolie pulmonaire"},
    {"code": "I38", "libelle": "Endocardite, valvule non précisée"},
    {"code": "I42", "libelle": "Cardiomyopathie"},
    {"code": "I48", "libelle": "Fibrillation et flutter auriculaires"},
    {"code": "I50", "libelle": "Insuffisance cardiaque"},
    {"code": "I63", "libelle": "Infarctus cérébral"},
    {"code": "I64", "libelle": "Accident vasculaire cérébral, non précisé"},

    # ─── MALADIES DIGESTIVES ───
    {"code": "K02", "libelle": "Carie dentaire"},
    {"code": "K08", "libelle": "Autres affections des dents et structures de soutien"},
    {"code": "K21", "libelle": "Maladie de reflux gastro-oesophagien"},
    {"code": "K25", "libelle": "Ulcère gastrique"},
    {"code": "K26", "libelle": "Ulcère duodénal"},
    {"code": "K29.7", "libelle": "Gastrite, sans précision"},
    {"code": "K35", "libelle": "Appendicite aiguë"},
    {"code": "K37", "libelle": "Appendicite, sans précision"},
    {"code": "K40", "libelle": "Hernie inguinale"},
    {"code": "K52", "libelle": "Autres gastro-entérites et colites non infectieuses"},
    {"code": "K59.0", "libelle": "Constipation"},
    {"code": "K70", "libelle": "Maladie alcoolique du foie"},
    {"code": "K71", "libelle": "Maladie toxique du foie"},
    {"code": "K72", "libelle": "Insuffisance hépatique"},
    {"code": "K74", "libelle": "Fibrose et cirrhose du foie"},
    {"code": "K80", "libelle": "Lithiase biliaire (calculs)"},
    {"code": "K85", "libelle": "Pancréatite aiguë"},

    # ─── MALADIES URINAIRES ET GÉNITALES ───
    {"code": "N10", "libelle": "Néphrite tubulo-interstitielle aiguë (pyélonéphrite aiguë)"},
    {"code": "N11", "libelle": "Néphrite tubulo-interstitielle chronique (pyélonéphrite chronique)"},
    {"code": "N18", "libelle": "Insuffisance rénale chronique"},
    {"code": "N19", "libelle": "Insuffisance rénale, sans précision"},
    {"code": "N30", "libelle": "Cystite"},
    {"code": "N39.0", "libelle": "Infection des voies urinaires, sans précision"},
    {"code": "N40", "libelle": "Hyperplasie de la prostate"},
    {"code": "N43", "libelle": "Hydrocèle et spermatocèle"},
    {"code": "N70", "libelle": "Salpingite et oophorite"},
    {"code": "N71", "libelle": "Maladie inflammatoire de l'utérus"},
    {"code": "N73", "libelle": "Autres maladies pelviennes inflammatoires féminines"},
    {"code": "N76", "libelle": "Autres inflammations du vagin et de la vulve"},
    {"code": "N80", "libelle": "Endométriose"},
    {"code": "N92", "libelle": "Règles abondantes, fréquentes et irrégulières"},
    {"code": "N93", "libelle": "Autres saignements anormaux de l'utérus et du vagin"},

    # ─── MALADIES ENDOCRINIENNES ET MÉTABOLIQUES ───
    {"code": "E10", "libelle": "Diabète sucré de type 1"},
    {"code": "E11", "libelle": "Diabète sucré de type 2"},
    {"code": "E11.0", "libelle": "Diabète de type 2 avec coma"},
    {"code": "E11.6", "libelle": "Diabète de type 2 avec autres complications précisées"},
    {"code": "E11.9", "libelle": "Diabète de type 2, sans complication"},
    {"code": "E14", "libelle": "Diabète sucré, sans précision"},
    {"code": "E03", "libelle": "Autre hypothyroïdie"},
    {"code": "E05", "libelle": "Thyrotoxicose (hyperthyroïdie)"},
    {"code": "E40", "libelle": "Kwashiorkor"},
    {"code": "E41", "libelle": "Marasme nutritionnel"},
    {"code": "E43", "libelle": "Malnutrition protéino-calorique sévère, sans précision"},
    {"code": "E44", "libelle": "Malnutrition protéino-calorique modérée et légère"},
    {"code": "E46", "libelle": "Malnutrition protéino-calorique, sans précision"},
    {"code": "E50", "libelle": "Carence en vitamine A"},
    {"code": "E55.9", "libelle": "Carence en vitamine D (rachitisme)"},
    {"code": "E58", "libelle": "Carence alimentaire en calcium"},
    {"code": "E61.1", "libelle": "Carence en fer"},
    {"code": "E66", "libelle": "Obésité"},
    {"code": "E66.0", "libelle": "Obésité due à un excès calorique"},

    # ─── ANÉMIES ───
    {"code": "D50", "libelle": "Anémie par carence en fer"},
    {"code": "D51", "libelle": "Anémie par carence en vitamine B12"},
    {"code": "D52", "libelle": "Anémie par carence en folates (acide folique)"},
    {"code": "D55", "libelle": "Anémie due à des enzymopathies"},
    {"code": "D57", "libelle": "Drépanocytose"},
    {"code": "D57.0", "libelle": "Drépanocytose avec crise vaso-occlusive"},
    {"code": "D57.1", "libelle": "Drépanocytose sans crise"},
    {"code": "D64.9", "libelle": "Anémie, sans précision"},

    # ─── GROSSESSE ET ACCOUCHEMENT ───
    {"code": "O00", "libelle": "Grossesse extra-utérine (GEU)"},
    {"code": "O02.0", "libelle": "Oeuf clair (grossesse anembryonnaire)"},
    {"code": "O03", "libelle": "Avortement spontané (fausse couche)"},
    {"code": "O10", "libelle": "Hypertension pré-existante compliquant la grossesse"},
    {"code": "O11", "libelle": "Troubles hypertensifs pré-existants avec protéinurie surajoutée"},
    {"code": "O12", "libelle": "Oedème et protéinurie gestationnels"},
    {"code": "O13", "libelle": "Hypertension gestationnelle (HTA gravidique)"},
    {"code": "O14", "libelle": "Pré-éclampsie"},
    {"code": "O14.1", "libelle": "Pré-éclampsie sévère"},
    {"code": "O15", "libelle": "Éclampsie"},
    {"code": "O20", "libelle": "Hémorragie au début de la grossesse"},
    {"code": "O24", "libelle": "Diabète sucré survenant au cours de la grossesse (diabète gestationnel)"},
    {"code": "O36.0", "libelle": "Soins maternels pour iso-immunisation Rhésus"},
    {"code": "O44", "libelle": "Placenta praevia"},
    {"code": "O45", "libelle": "Décollement prématuré du placenta"},
    {"code": "O60", "libelle": "Travail et accouchement prématurés"},
    {"code": "O62", "libelle": "Anomalies de la dynamique utérine"},
    {"code": "O72", "libelle": "Hémorragie du post-partum"},
    {"code": "O85", "libelle": "Sepsis puerpéral"},
    {"code": "O86", "libelle": "Autres infections du post-partum"},

    # ─── NOUVEAU-NÉ ET PÉDIATRIE ───
    {"code": "P07", "libelle": "Troubles liés à une brièveté de la gestation (prématurité)"},
    {"code": "P21", "libelle": "Asphyxie à la naissance"},
    {"code": "P22", "libelle": "Détresse respiratoire du nouveau-né"},
    {"code": "P36", "libelle": "Septicémie bactérienne du nouveau-né"},
    {"code": "P55", "libelle": "Maladie hémolytique du foetus et du nouveau-né"},
    {"code": "P59", "libelle": "Ictère du nouveau-né dû à d'autres causes"},
    {"code": "P59.0", "libelle": "Ictère associé à une prématurité"},
    {"code": "P59.9", "libelle": "Ictère néonatal, sans précision"},
    {"code": "P92", "libelle": "Difficultés d'alimentation du nouveau-né"},

    # ─── MALADIES NEUROLOGIQUES ───
    {"code": "G03", "libelle": "Méningite due à d'autres causes et à des causes non précisées"},
    {"code": "G04", "libelle": "Encéphalite, myélite et encéphalomyélite"},
    {"code": "G40", "libelle": "Épilepsie"},
    {"code": "G40.9", "libelle": "Épilepsie, sans précision"},
    {"code": "G43", "libelle": "Migraine"},
    {"code": "G44", "libelle": "Autres syndromes algiques céphaliques"},
    {"code": "R51", "libelle": "Céphalée"},

    # ─── MALADIES DERMATOLOGIQUES ───
    {"code": "L01", "libelle": "Impétigo"},
    {"code": "L02", "libelle": "Abcès cutané, furoncle et anthrax"},
    {"code": "L03", "libelle": "Cellulite"},
    {"code": "L20", "libelle": "Dermatite atopique (eczéma atopique)"},
    {"code": "L23", "libelle": "Dermatite allergique de contact"},
    {"code": "L29", "libelle": "Prurit"},
    {"code": "L40", "libelle": "Psoriasis"},
    {"code": "L50", "libelle": "Urticaire"},

    # ─── TRAUMATISMES ET BRÛLURES ───
    {"code": "S00", "libelle": "Traumatisme superficiel de la tête"},
    {"code": "S01", "libelle": "Plaie ouverte de la tête"},
    {"code": "S06", "libelle": "Traumatisme intracrânien"},
    {"code": "S52", "libelle": "Fracture de l'avant-bras"},
    {"code": "S62", "libelle": "Fracture au niveau du poignet et de la main"},
    {"code": "S72", "libelle": "Fracture du fémur"},
    {"code": "S82", "libelle": "Fracture de la jambe"},
    {"code": "T14.0", "libelle": "Plaie ouverte d'une région du corps non précisée"},
    {"code": "T20", "libelle": "Brûlure et corrosion de la tête et du cou"},
    {"code": "T30", "libelle": "Brûlure et corrosion, région du corps non précisée"},
    {"code": "T63.0", "libelle": "Effet toxique du venin de serpent"},
    {"code": "T70.3", "libelle": "Coup de chaleur et insolation"},
    {"code": "T71", "libelle": "Asphyxie"},

    # ─── SYMPTÔMES ET SIGNES NON CLASSÉS AILLEURS ───
    {"code": "R00.0", "libelle": "Tachycardie, sans précision"},
    {"code": "R05", "libelle": "Toux"},
    {"code": "R06.0", "libelle": "Dyspnée"},
    {"code": "R07", "libelle": "Douleur dans la gorge et dans la poitrine"},
    {"code": "R10", "libelle": "Douleur abdominale"},
    {"code": "R11", "libelle": "Nausées et vomissements"},
    {"code": "R17", "libelle": "Ictère non classé ailleurs"},
    {"code": "R19.7", "libelle": "Diarrhée, sans précision"},
    {"code": "R20.0", "libelle": "Anesthésie cutanée"},
    {"code": "R50.9", "libelle": "Fièvre, sans précision"},
    {"code": "R55", "libelle": "Syncope et lipothymie"},
    {"code": "R56", "libelle": "Convulsions"},
    {"code": "R56.0", "libelle": "Convulsions fébriles"},
    {"code": "R56.8", "libelle": "Autres convulsions"},
    {"code": "R57", "libelle": "Choc, non classé ailleurs"},
    {"code": "R60", "libelle": "Oedème, non classé ailleurs"},
    {"code": "R62.0", "libelle": "Retard dans le développement des étapes (moteur)"},
    {"code": "R63.0", "libelle": "Anorexie"},
    {"code": "R64", "libelle": "Cachexie"},

    # ─── CANCERS FRÉQUENTS EN AFRIQUE SUBSAHARIENNE ───
    {"code": "C16", "libelle": "Tumeur maligne de l'estomac"},
    {"code": "C18", "libelle": "Tumeur maligne du côlon"},
    {"code": "C22", "libelle": "Tumeur maligne du foie et des voies biliaires intrahépatiques"},
    {"code": "C22.0", "libelle": "Carcinome hépatocellulaire"},
    {"code": "C53", "libelle": "Tumeur maligne du col de l'utérus"},
    {"code": "C54", "libelle": "Tumeur maligne du corps de l'utérus"},
    {"code": "C50", "libelle": "Tumeur maligne du sein"},
    {"code": "C61", "libelle": "Tumeur maligne de la prostate"},
    {"code": "C67", "libelle": "Tumeur maligne de la vessie"},
    {"code": "C71", "libelle": "Tumeur maligne de l'encéphale"},
    {"code": "C76.0", "libelle": "Tumeur maligne de la tête, du visage et du cou"},

    # ─── MALADIES OCULAIRES ───
    {"code": "H10", "libelle": "Conjonctivite"},
    {"code": "H16", "libelle": "Kératite"},
    {"code": "H25", "libelle": "Cataracte sénile"},
    {"code": "H26", "libelle": "Autres cataractes"},
    {"code": "H40", "libelle": "Glaucome"},
    {"code": "H54", "libelle": "Cécité et déficience visuelle"},

    # ─── MALADIES ORL ───
    {"code": "H60", "libelle": "Otite externe"},
    {"code": "H65", "libelle": "Otite moyenne non suppurée"},
    {"code": "H66", "libelle": "Otite moyenne suppurée et non précisée"},
    {"code": "H71", "libelle": "Cholestéatome de l'oreille moyenne"},
    {"code": "H81.0", "libelle": "Maladie de Ménière"},
    {"code": "H90", "libelle": "Surdité de transmission et neurosensorielle"},
    {"code": "J32", "libelle": "Sinusite chronique"},
    {"code": "J35.0", "libelle": "Amygdalite chronique"},
    {"code": "J36", "libelle": "Abcès périamygdalien"},

    # ─── SANTÉ MENTALE ───
    {"code": "F10", "libelle": "Troubles mentaux liés à l'utilisation de l'alcool"},
    {"code": "F19", "libelle": "Troubles mentaux liés à l'utilisation de substances psychoactives"},
    {"code": "F20", "libelle": "Schizophrénie"},
    {"code": "F32", "libelle": "Épisode dépressif"},
    {"code": "F41.1", "libelle": "Anxiété généralisée"},
    {"code": "F43.2", "libelle": "Trouble de l'adaptation"},

    # ─── CODES COVID-19 ───
    {"code": "U07.1", "libelle": "COVID-19, virus identifié"},
    {"code": "U07.2", "libelle": "COVID-19, virus non identifié"},
]


@router.get("/search")
async def search_cim10(
    q: str = Query(..., min_length=2, description="Code ou libellé à rechercher"),
    limit: int = Query(20, ge=1, le=50)
):
    """Recherche dans la base CIM-10 par code ou libellé."""
    q_lower = q.lower().strip()
    results = [
        item for item in CIM10_DB
        if q_lower in item["code"].lower() or q_lower in item["libelle"].lower()
    ]
    return {"total": len(results), "results": results[:limit]}


@router.get("/code/{code}")
async def get_cim10_by_code(code: str):
    """Récupère un code CIM-10 précis."""
    code_upper = code.upper().strip()
    item = next((i for i in CIM10_DB if i["code"] == code_upper), None)
    if not item:
        from fastapi import HTTPException
        raise HTTPException(404, f"Code CIM-10 '{code}' non trouvé")
    return item
