# Image upload guide

Drop your real photos into this folder using the exact filenames below.
Until a file exists, that spot on the site shows a soft branded
placeholder instead of a broken image — so the site looks good either way,
and upgrades automatically the moment you add the real photo (no code
changes needed).

| Upload this file here                        | Used for                          | Suggested size (W x H) |
|-----------------------------------------------|------------------------------------|-------------------------|
| /public/images/hero-bg.jpg                     | Homepage hero background photo     | 1600 x 1200 (landscape) |
| /public/images/hero-product.png                | Floating product shot in the hero  | 500 x 650 (portrait)    |
| /public/images/mega-menu-feature.jpg           | "Shop" mega-menu featured thumbnail| 300 x 250               |
| /public/images/brand-story-bg.jpg              | "Beauty should feel like you" section background | 1600 x 900 |
| /public/images/spotlight-product.png           | Fallback product spotlight photo (only used if that product has no photo yet) | 600 x 750 |
| /public/images/promo-bg.jpg                    | Discount/promo banner background texture | 1600 x 600 |
| /public/images/social/1.jpg ... social/8.jpg   | "Follow @INFINIX" gallery grid (8 photos) | mix of square (400x400) and tall (400x600) |
| /public/images/moods/everyday.jpg              | "Find Your Signature" mood picker  | 600 x 400 |
| /public/images/moods/date-night.jpg            | same as above                      | 600 x 400 |
| /public/images/moods/party.jpg                 | same as above                      | 600 x 400 |
| /public/images/moods/fresh.jpg                 | same as above                      | 600 x 400 |
| /public/images/moods/bold.jpg                  | same as above                      | 600 x 400 |
| /public/images/moods/soft.jpg                  | same as above                      | 600 x 400 |
| /public/images/moods/outdoors.jpg              | same as above                      | 600 x 400 |
| /public/images/moods/work.jpg                  | same as above                      | 600 x 400 |

## Category tile photos (auto-matched to your real categories)

The "Our Collections" grid pulls your actual categories from the admin
panel and looks for a matching image at:

    /public/images/collections/<category-slug>.jpg

e.g. a category with slug `body-sprays` looks for
`/public/images/collections/body-sprays.jpg`. Check each category's slug
in the admin panel and upload a photo (roughly 700 x 700, a couple of them
can be taller — the grid mixes sizes) with that exact filename.

## Product photos

Product photos (Best Sellers rail, product spotlight, product detail
pages) are NOT uploaded here — they're uploaded per-product through the
admin panel's product image upload, same as before. This folder is only
for site-wide marketing/decorative imagery.
