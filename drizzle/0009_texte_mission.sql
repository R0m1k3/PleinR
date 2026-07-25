-- Texte de mission enrichi sur la page Association.
--
-- La clause sur `value` est volontaire : le texte n'est remplacé que s'il est
-- resté celui d'origine. Une mission déjà réécrite depuis Paramètres n'est
-- jamais écrasée. Les « apports » n'ont pas de ligne en base tant qu'ils n'ont
-- pas été édités : leur valeur par défaut s'applique d'elle-même.
UPDATE "site_settings"
SET "value" = 'Plein R fédère les commerçants, artisans et entreprises du Bassin de Pompey autour d''une conviction simple : on va plus loin ensemble. L''association crée les occasions de se rencontrer, de se connaître et de travailler les uns avec les autres.

Nous mettons chaque adhérent en avant auprès des habitants comme des autres professionnels du territoire : une fiche dans l''annuaire, des bons plans relayés sur le site et sur nos réseaux sociaux, une place dans nos rencontres et nos publications.

L''objectif est double : amener des clients aux commerces de proximité, et faire naître des courants d''affaires entre les entreprises du bassin.',
    "updated_at" = now()
WHERE "key" = 'association_mission'
  AND "value" = 'Créer du lien entre adhérents, encourager les échanges de proximité et porter une dynamique collective au service du Bassin de Pompey.';
