<?php
// Konfigurasi MCP Server lokal
define('MCP_URL', 'http://127.0.0.1:3000/ask');
define('JWT_TOKEN', 'magjwt');

header('Content-Type: application/json');
$q = $_POST['q'] ?? '';
if(!$q) {
    http_response_code(400);
    echo json_encode(['error'=>'Pertanyaan kosong.']);
    exit;
}

$data = json_encode(['question' => $q]);
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, MCP_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . JWT_TOKEN
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 25);

$result = curl_exec($ch);
$err = curl_error($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($err) {
    http_response_code(502);
    echo json_encode(['error'=>'Gagal koneksi ke MCP Server.']);
    exit;
}

if ($httpcode != 200) {
    $res = json_decode($result, true);
    $errMsg = $res['error'] ?? 'Terjadi error pada MCP Server.';
    echo json_encode(['error'=>$errMsg]);
    exit;
}

echo $result;
exit;
?>
