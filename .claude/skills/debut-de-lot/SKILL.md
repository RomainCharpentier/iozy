---
name: debut-de-lot
description: Ouvre un lot en quatre temps : cadrer, explorer sans coder, planifier, valider. Aucun code avant l'accord sur le plan.
disable-model-invocation: true
---

# Début de lot

Le lot à ouvrir : $ARGUMENTS

Ne modifie aucun fichier avant l'étape 4.

1. **Cadrer** : reformule l'intention en deux ou trois phrases, puis écris les **critères d'acceptation**, chacun vérifiable (un test, une commande, un texte lu à l'écran). Liste les zones d'ombre et les cas limites, et pose seulement les questions dont la réponse change le travail. Si une maquette de `design_handoff_v2/` a plusieurs planches du même écran, dis ce que chacune propose et fais trancher.
2. **Explorer** : lis le code existant concerné, sans le modifier. Si l'exploration est large, délègue-la à un sous-agent pour garder cette conversation légère. Cherche d'abord ce qui existe déjà à réutiliser (modules `common/`, points d'extension de `core`). Résume en quelques lignes ce que tu as appris.
3. **Planifier** : propose un plan court : fichiers touchés, ordre des étapes, et pour chaque critère d'acceptation **comment il sera prouvé** (quel test, quel parcours e2e, quelle vérification en direct). Signale ce qui est hors périmètre.
4. **Valider** : attends l'accord ou la correction du plan. Ensuite seulement, implémente par petites étapes, en lançant la vérification après chacune. Le lot se termine par `/fin-de-lot`.
