<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'config.php';

function fetchHTML($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $html = curl_exec($ch);
    curl_close($ch);
    return $html;
}

function extractIdFromUrl($url) {
    if (preg_match('/\/(\d+)\//', $url, $matches)) {
        return $matches[1];
    }
    return null;
}

function searchMovies($query) {
    $domains = [
        'https://www.cinecalidad.ec',
        'https://www.cinecalidad.rs',
        'https://cinecalidad.onl'
    ];
    
    $movies = [];
    $queryLower = strtolower($query);
    
    foreach ($domains as $domain) {
        $searchUrl = $domain . "/?s=" . urlencode($query);
        $html = fetchHTML($searchUrl);
        
        if (!$html) continue;
        
        $dom = new DOMDocument();
        @$dom->loadHTML($html);
        $xpath = new DOMXPath($dom);
        
        $nodes = $xpath->query("//a[contains(@href, '/ver-pelicula/') or contains(@href, '/pelicula/')]");
        
        foreach ($nodes as $node) {
            $url = $node->getAttribute('href');
            $titleNode = $xpath->query(".//h3|.//h2|.//*[contains(@class, 'title')]", $node);
            $title = $titleNode->length > 0 ? trim($titleNode->item(0)->textContent) : trim($node->textContent);
            
            if ($title && stripos($title, $queryLower) !== false) {
                $thumbnailNode = $xpath->query(".//img", $node);
                $thumbnail = $thumbnailNode->length > 0 ? $thumbnailNode->item(0)->getAttribute('src') : null;
                
                $movies[] = [
                    'id' => extractIdFromUrl($url),
                    'title' => $title,
                    'url' => $url,
                    'thumbnail' => $thumbnail,
                    'provider' => 'cinecalidad'
                ];
            }
        }
        
        if (count($movies) > 0) break;
    }
    
    return $movies;
}

function getMovieInfo($url) {
    $html = fetchHTML($url);
    if (!$html) return null;
    
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    $xpath = new DOMXPath($dom);
    
    // Título
    $titleNode = $xpath->query("//h1");
    $title = $titleNode->length > 0 ? trim($titleNode->item(0)->textContent) : 'Sin título';
    
    // Año
    $year = null;
    $yearNodes = $xpath->query("//*[contains(@class, 'year') or contains(@class, 'date')]");
    foreach ($yearNodes as $node) {
        if (preg_match('/\b(19|20)\d{2}\b/', $node->textContent, $matches)) {
            $year = $matches[0];
            break;
        }
    }
    
    // Sinopsis
    $synopsis = '';
    $synopsisNodes = $xpath->query("//*[contains(@class, 'description') or contains(@class, 'sinopsis') or contains(@class, 'plot')]");
    foreach ($synopsisNodes as $node) {
        $text = trim($node->textContent);
        if (strlen($text) > 100) {
            $synopsis = $text;
            break;
        }
    }
    
    // Servidores (iframes)
    $servers = [];
    $iframeNodes = $xpath->query("//iframe");
    foreach ($iframeNodes as $iframe) {
        $src = $iframe->getAttribute('src');
        if ($src && str_starts_with($src, 'http')) {
            $servers[] = [
                'server' => 'Servidor ' . (count($servers) + 1),
                'url' => $src,
                'type' => 'iframe'
            ];
        }
    }
    
    // Servidores data-resolved-url
    $dataNodes = $xpath->query("//*[@data-resolved-url]");
    foreach ($dataNodes as $node) {
        $url = $node->getAttribute('data-resolved-url');
        if ($url && str_starts_with($url, 'http')) {
            $servers[] = [
                'server' => trim($node->textContent) ?: 'Servidor',
                'url' => $url,
                'type' => 'iframe'
            ];
        }
    }
    
    // Poster
    $poster = null;
    $posterNodes = $xpath->query("//*[contains(@class, 'poster')]//img");
    if ($posterNodes->length > 0) {
        $poster = $posterNodes->item(0)->getAttribute('src');
    }
    
    return [
        'title' => $title,
        'year' => $year,
        'synopsis' => substr($synopsis, 0, 500) ?: 'Sinopsis no disponible',
        'url' => $url,
        'provider' => 'cinecalidad',
        'poster' => $poster,
        'downloadLinks' => $servers
    ];
}

$action = $_GET['action'] ?? '';
$query = $_GET['q'] ?? '';
$url = $_GET['url'] ?? '';

if ($action === 'search' && $query) {
    $results = searchMovies($query);
    echo json_encode(['success' => true, 'results' => $results]);
} elseif ($action === 'info' && $url) {
    $data = getMovieInfo($url);
    echo json_encode(['success' => true, 'data' => $data]);
} else {
    echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
}
?>