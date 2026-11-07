-- Recherche locale : la ville (et ses variantes, ex. « bgayet », « tizi wezzu ») et la
-- région de l'annonce entrent dans le vecteur plein texte (poids D).
CREATE OR REPLACE FUNCTION tm_listing_search_vector() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  category_name text;
  region_name text;
  city_terms text;
BEGIN
  SELECT c."name" INTO category_name FROM "category" c WHERE c."id" = NEW."categoryId";
  SELECT r."name" INTO region_name FROM "region" r WHERE r."id" = NEW."regionId";
  SELECT ci."name" || ' ' || array_to_string(ci."searchNames", ' ') INTO city_terms FROM "city" ci WHERE ci."id" = NEW."cityId";
  NEW."searchVector" :=
    setweight(to_tsvector('french', tm_unaccent(coalesce(NEW."title", ''))), 'A') ||
    setweight(to_tsvector('simple', tm_unaccent(coalesce(NEW."title", ''))), 'A') ||
    setweight(to_tsvector('simple', tm_unaccent(coalesce(NEW."brandName", ''))), 'B') ||
    setweight(to_tsvector('french', tm_unaccent(coalesce(category_name, ''))), 'C') ||
    setweight(to_tsvector('french', tm_unaccent(coalesce(NEW."description", ''))), 'D') ||
    setweight(to_tsvector('simple', tm_unaccent(coalesce(city_terms, '') || ' ' || coalesce(NEW."locality", '') || ' ' || coalesce(region_name, ''))), 'D');
  RETURN NEW;
END $$;

DROP TRIGGER "listing_search_vector_update" ON "listing";
CREATE TRIGGER "listing_search_vector_update"
  BEFORE INSERT OR UPDATE OF "title", "description", "brandName", "categoryId", "regionId", "cityId", "locality" ON "listing"
  FOR EACH ROW EXECUTE FUNCTION tm_listing_search_vector();

-- Recalcul des vecteurs existants.
UPDATE "listing" SET "title" = "title";
