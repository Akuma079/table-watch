-- Nouveau forfait gratuit. Seul dans sa migration : PostgreSQL interdit d'utiliser une
-- valeur d'enum dans la transaction qui l'a créée.
ALTER TYPE "WorkspacePlan" ADD VALUE 'FREE';
