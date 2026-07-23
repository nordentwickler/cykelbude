<?php

namespace modules\sitemodule\controllers;

use Craft;
use craft\elements\Entry;
use craft\web\Controller;
use yii\web\Response;

/**
 * Erzeugt dynamische Share-/OG-Bilder (1200x630): dunkler Hintergrund,
 * weiße cykelbude-Wortmarke, Seitentitel in Pink. Ergebnis wird auf Platte
 * gecacht und statisch ausgeliefert. Aufruf über die Route /og/<id>.
 *
 * Nutzt GD (überall verfügbar) statt Imagick. Das SVG-Logo kann GD nicht
 * rastern, deshalb liegt eine vorgerenderte weiße PNG-Wortmarke bei
 * (src/assets/icons/logo-white-og.png).
 */
class OgController extends Controller
{
    protected array|bool|int $allowAnonymous = true;

    private const W = 1200;
    private const H = 630;
    private const NAVY = [0x1d, 0x21, 0x33];
    private const PINK = [0xea, 0x4d, 0x65];
    private const PADDING = 80;
    private const LOGO_WIDTH = 380;
    private const VERSION = 'v2'; // erhöhen, wenn sich das Layout ändert

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
        $logoPath = $root . '/src/assets/icons/logo-white-og.png';

        // In storage/runtime cachen (immer beschreibbar) und über den
        // Controller streamen - unabhängig von den Rechten auf public/.
        $cacheDir = Craft::getAlias('@runtime') . '/og';
        $key = md5($title . '|' . self::VERSION);
        $cacheFile = $cacheDir . '/og-' . $key . '.png';

        try {
            if (!is_file($cacheFile)) {
                if (!is_dir($cacheDir)) {
                    @mkdir($cacheDir, 0775, true);
                }
                $this->generateImage($title, $fontPath, $logoPath, $cacheFile);
            }
        } catch (\Throwable $e) {
            Craft::error('OG-Bild konnte nicht erzeugt werden: ' . $e->getMessage(), __METHOD__);
            throw $e;
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
        $img = imagecreatetruecolor(self::W, self::H);
        imagesavealpha($img, true);

        $navy = imagecolorallocate($img, ...self::NAVY);
        $pink = imagecolorallocate($img, ...self::PINK);
        imagefilledrectangle($img, 0, 0, self::W, self::H, $navy);

        // Wortmarke (weiß, vorgerendertes PNG) oben links
        $logoBottom = self::PADDING;
        if (is_file($logoPath) && ($logo = @imagecreatefrompng($logoPath))) {
            $srcW = imagesx($logo);
            $srcH = imagesy($logo);
            $dstW = self::LOGO_WIDTH;
            $dstH = (int) round($srcH * $dstW / $srcW);
            imagecopyresampled($img, $logo, self::PADDING, self::PADDING, 0, 0, $dstW, $dstH, $srcW, $srcH);
            imagedestroy($logo);
            $logoBottom = self::PADDING + $dstH;
        }

        // Titel in Pink, Bebas Neue, umgebrochen und auf die Höhe eingepasst
        $maxWidth = self::W - 2 * self::PADDING;
        $startY = $logoBottom + 90;
        $available = self::H - $startY - self::PADDING;

        $fontSize = 110;
        $lines = [];
        while ($fontSize >= 54) {
            $lines = $this->wrap($fontPath, $fontSize, $title, $maxWidth);
            $lineHeight = $fontSize * 1.08;
            if (count($lines) * $lineHeight <= $available) {
                break;
            }
            $fontSize -= 8;
        }

        $lineHeight = $fontSize * 1.08;
        $y = $startY + $fontSize;
        foreach ($lines as $line) {
            imagettftext($img, $fontSize, 0, self::PADDING, (int) round($y), $pink, $fontPath, $line);
            $y += $lineHeight;
        }

        imagepng($img, $cacheFile);
        imagedestroy($img);
    }

    /**
     * Text an der maximalen Breite in Zeilen umbrechen (wortweise).
     *
     * @return string[]
     */
    private function wrap(string $fontPath, float $fontSize, string $text, float $maxWidth): array
    {
        $words = preg_split('/\s+/', trim($text));
        $lines = [];
        $line = '';

        foreach ($words as $word) {
            $candidate = $line === '' ? $word : $line . ' ' . $word;
            if ($this->textWidth($fontPath, $fontSize, $candidate) > $maxWidth && $line !== '') {
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

    private function textWidth(string $fontPath, float $fontSize, string $text): float
    {
        $box = imagettfbbox($fontSize, 0, $fontPath, $text);

        return abs($box[2] - $box[0]);
    }
}
