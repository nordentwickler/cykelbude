<?php

namespace modules\sitemodule\controllers;

use Craft;
use craft\elements\Entry;
use craft\web\Controller;
use Imagick;
use ImagickDraw;
use ImagickPixel;
use yii\web\Response;

/**
 * Erzeugt dynamische Share-/OG-Bilder (1200x630): dunkler Hintergrund,
 * weiße cykelbude-Wortmarke, Seitentitel in Pink. Ergebnis wird auf Platte
 * gecacht und statisch ausgeliefert. Aufruf über die Route /og/<id>.
 */
class OgController extends Controller
{
    protected array|bool|int $allowAnonymous = true;

    private const W = 1200;
    private const H = 630;
    private const NAVY = '#1d2133';
    private const PINK = '#ea4d65';
    private const PADDING = 80;
    private const VERSION = 'v1'; // erhöhen, wenn sich das Layout ändert

    public function actionImage(int $id = 0): Response
    {
        $title = 'cykelbude';

        if ($id) {
            $entry = Entry::find()->id($id)->status(null)->one();
            if ($entry) {
                $title = trim($entry->title) ?: $title;
            }
        }

        $root = Craft::getAlias('@root');
        $fontPath = $root . '/src/assets/fonts/BebasNeue-Regular.ttf';
        $logoPath = $root . '/src/assets/icons/logo.svg';

        $cacheDir = Craft::getAlias('@webroot') . '/og';
        $key = md5($title . '|' . self::VERSION);
        $cacheFile = $cacheDir . '/og-' . $key . '.png';

        if (!is_file($cacheFile)) {
            if (!is_dir($cacheDir)) {
                @mkdir($cacheDir, 0775, true);
            }
            $this->generateImage($title, $fontPath, $logoPath, $cacheFile);
        }

        $response = Craft::$app->getResponse();
        $response->format = Response::FORMAT_RAW;
        $response->headers->set('Content-Type', 'image/png');
        $response->headers->set('Cache-Control', 'public, max-age=604800');
        $response->content = file_get_contents($cacheFile);

        return $response;
    }

    private function generateImage(string $title, string $fontPath, string $logoPath, string $cacheFile): void
    {
        $img = new Imagick();
        $img->newImage(self::W, self::H, new ImagickPixel(self::NAVY));
        $img->setImageFormat('png');

        // Wortmarke (weiß) oben links
        $logoBottom = self::PADDING;
        if (is_file($logoPath)) {
            $svg = file_get_contents($logoPath);
            // Pfade haben keine eigene Farbe -> auf Weiß setzen
            $svg = str_replace('<path ', '<path fill="#ffffff" ', $svg);

            try {
                $logo = new Imagick();
                $logo->setBackgroundColor(new ImagickPixel('transparent'));
                $logo->readImageBlob($svg);
                $logo->setImageFormat('png32');
                $logoWidth = 380;
                $logo->resizeImage($logoWidth, 0, Imagick::FILTER_LANCZOS, 1);
                $img->compositeImage($logo, Imagick::COMPOSITE_OVER, self::PADDING, self::PADDING);
                $logoBottom = self::PADDING + $logo->getImageHeight();
                $logo->clear();
            } catch (\Throwable $e) {
                Craft::warning('OG-Logo konnte nicht gerendert werden: ' . $e->getMessage(), __METHOD__);
            }
        }

        // Titel in Pink, Bebas Neue, umgebrochen und auf die Höhe eingepasst
        $draw = new ImagickDraw();
        $draw->setFillColor(new ImagickPixel(self::PINK));
        $draw->setFont($fontPath);

        $maxWidth = self::W - 2 * self::PADDING;
        $startY = $logoBottom + 90;
        $available = self::H - $startY - self::PADDING;

        $fontSize = 110;
        $lines = [];
        while ($fontSize >= 54) {
            $draw->setFontSize($fontSize);
            $lines = $this->wrap($img, $draw, $title, $maxWidth);
            $lineHeight = $fontSize * 1.08;
            if (count($lines) * $lineHeight <= $available) {
                break;
            }
            $fontSize -= 8;
        }

        $lineHeight = $fontSize * 1.08;
        $y = $startY + $fontSize;
        foreach ($lines as $line) {
            $img->annotateImage($draw, self::PADDING, $y, 0, $line);
            $y += $lineHeight;
        }

        $img->writeImage($cacheFile);
        $img->clear();
    }

    /**
     * Text an der maximalen Breite in Zeilen umbrechen (wortweise).
     *
     * @return string[]
     */
    private function wrap(Imagick $img, ImagickDraw $draw, string $text, float $maxWidth): array
    {
        $words = preg_split('/\s+/', trim($text));
        $lines = [];
        $line = '';

        foreach ($words as $word) {
            $candidate = $line === '' ? $word : $line . ' ' . $word;
            $metrics = $img->queryFontMetrics($draw, $candidate);
            if ($metrics['textWidth'] > $maxWidth && $line !== '') {
                $lines[] = $line;
                $line = $word;
            } else {
                $line = $candidate;
            }
        }

        if ($line !== '') {
            $lines[] = $line;
        }

        return $lines;
    }
}
