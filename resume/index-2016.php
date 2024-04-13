<html>
<head>
	<title>Andrew Zamler-Carhart</title>

</head>
<style type="text/css">
<!--
	td { font: 12px/1.4em Avenir, Myriad Apple, Verdana; }
	a { color: blue; }
	ul { padding: 0px 0px 0px 25px; 
		margin: 0px 0px 0px 0px; }
	ul.points {
		padding: 10px 0px 0px 25px; 
	} 
-->
</style>
<body>
<table width="855" border="0" cellspacing="0" cellpadding="0"><tr>
<td>&nbsp;</td>
<td width="730">
<table width="730" border="0" cellspacing="7" cellpadding="5">
	<tr><td><b><font size="5">Andrew Zamler-Carhart</font></b>

</td>
	<td align="right" valign="bottom">
		<a href="mailto:azc@mac.com">azc@mac.com</a><br>
		<!--Le Feuil, 43380 Blassac, France<br>-->
		1315 Findlay Ave, New York, NY, USA<br>
		<!--+33 6 21 15 04 01<br>-->
		+1 917 743 4969
	</td></tr>
</table>
<?php

$jobs = array(
	'Summary' => array(
		array(
			'description' => 'Stanford graduate, former Apple and Cisco employee, startup founder. 
			Creative software developer, passionate about human-centered application design. 
			Author of seven Mac digital media apps. 
			Experienced, responsible project manager. 
            Equally comfortable interfacing with technology and people.',
		),
	),
	'Expertise' => array(
		array(
			'points' => array(
				'Mac, iOS and Apple Watch app development in Objective-C and Swift', 
				'Android mobile and wearable app development in Java',
				'API design with REST and Socket.IO interfaces, JSON and XML formats',
				'Web development using HTML5, JavaScript, PHP, Node.js and Angular',
				'Beginning-to-end project management and team leadership'
			),
		),
	),
	'Experience' => array(
		array(
			'company' => 'Cisco',
			'location' => '(acquired&nbsp;NDS&nbsp;in&nbsp;2013)<br>Paris / New York',
			'start' => '2011',
			'end' => '2016',
			'url' => 'www.cisco.com',
			'title' => 'Technical Leader, Chief Technology &amp; Architecture Office (2013 &ndash; 2016)<br>Senior Technology Manager, New Initiatives (2011 &ndash; 2013)',
			'description' => 'Part of Cisco&rsquo;s elite team planning future technology directions: connecting devices in the Internet of Things, analyzing network data in the cloud, bringing television into the Internet age, and enabling multi-device video experiences. Responsibilities included brainstorming, rapid prototyping, conception, development, project management, demonstration and developer support.',
			'points' => array(
				'Led engineering team developing social features for cloud-based TV system', 
				'Developed second-screen application platform SDK, including server components, 
                <br>demo apps, frameworks, sample code, turorials and documentation',
				// 'Created platform for displaying video and apps spanning multiple device screens',
				'Designed indoor location platform for wearables using iBeacon and Wi-Fi sensors', 
                'Managed all user-facing components of open source, big data network analytics platform',
				'Presented at trade shows, developer conferences and hackathons', 
			),
		),
		array(
			'company' => 'KavaSoft',
			'location' => 'Santa&nbsp;Clara,&nbsp;CA<br>The&nbsp;Hague,&nbsp;NL',
			'start' => '2002',
			'end' => '2011',
			'url' => 'www.kavasoft.com',
			'title' => 'Founder &amp; CEO',
			'description' => 'Created seven applications for the Mac. Managed all aspects of running an online software business, including conception, development, sales, marketing and support.',
			'points' => array(
				'Created iConquer, one of the first games designed using native macOS technologies',
				'Built media management apps for photos, music, movies and image downloads',
				'Designed a web publishing solution using Objective-C, PHP and JavaScript',
				'Operated PHP/MySQL-based online store with secure license management',
			),
		),
/*		array(
			'company' => 'KavaFoto',
			'location' => 'The&nbsp;Hague,&nbsp;Netherlands',
			'start' => '2008',
			'end' => '2011',
			'url' => 'www.kavafoto.com',
			'title' => 'Photographer &amp; Developer',
			'description' => 'Documentary photography of music, art and fashion. Developed custom software to organize photos by content and publish them in realtime to a searchable website.',
			'points' => array(
				'Photographed over a hundred concerts of the Royal Conservatoire, The Hague', 
				'Developed custom software to organize photos by content and publish them in realtime to a searchable website', 
			), 
		),
*/		array(
			'company' => 'Apple',
			'location' => 'Cupertino,&nbsp;CA',
			'start' => '2001',
			'end' => '2002',
			'url' => 'sales.apple.com',
			'title' => 'Web Applications Developer',
			'description' => 'Responsible for the development and deployment of Apple Sales Web, a suite of enterprise WebObjects applications used by Apple resellers and Retail Stores worldwide.',
	/*		'points' => array(
				'Implemented a real-time XML messaging system to synchronize Oracle databases',
				'Integrated multiple data streams to provide efficient order and inventory management',
				'Designed Aqua interface components to give web applications a familiar look and feel',
				'Created time-saving user administration tool by working closely with end users',
				'Automated DVD content distribution processes, saving weeks of manual labor',
				'Managed content in multiple languages with interactive translation system',
			), */
		),
		array(
			'company' => 'SRI International',
			'location' => 'Menlo&nbsp;Park,&nbsp;CA',
			'start' => '2000',
			'end' => '2001',
			'url' => 'www.csl.sri.com',
			'title' => 'Web Technologist',
			'description' => 'Designed and programmed a WebObjects application to archive publications of the Computer Science Laboratory.',
		),
	),
	'Education' => array(
		array(
			'company' => 'Stanford&nbsp;University',
			'location' => 'Stanford,&nbsp;CA',
			'start' => '1996',
			'end' => '2000',
			'title' => 'Bachelor of Science in Symbolic Systems',
			'description' => 'Interdisciplinary program in Computer Science, Linguistics, Psychology &amp; Philosophy 


			<br>Specialization in Human-Computer Interaction<br>Minor in Russian Literature',
		),
	),
	'Personal Info' => array(
		array(
			'points' => array(
				'U.S. citizen, French resident permit',
				// 'Lives in New York City and France',
				'Native English speaker, fluent in French, proficient in Dutch and Russian',
			),
		),
	),
);

echo('<table border="0" cellspacing="9" cellpadding="5">');

foreach($jobs as $key => $section) {
	echo("<tr><td colspan=\"2\" bgcolor=\"#eeeeee\">$key</td></tr>");
	foreach ($section as $job) {
		echo('<tr><td valign="top">');
		if ($job['company']) echo("<b>{$job['company']}</b><br>");
		if ($job['location']) echo("{$job['location']}<br>");
		if ($job['start']) echo("{$job['start']} &ndash; {$job['end']}<br>");
		if ($job['url']) echo("<a href=\"http://{$job['url']}\">{$job['url']}</a><br>");
		echo('</td><td valign="top">');
		if ($job['title']) echo("<i>{$job['title']}</i><br>");
		if ($job['description']) echo("{$job['description']}<br>");
		// if ($job['description'] && $job['points']) echo('<br>'); 
		if ($job['points']) {
			if ($job['company']) echo('<ul class="points">');
			else echo('<ul>');
			foreach($job['points'] as $point) echo("<li>$point</li>");
			echo("</ul>");
		}
		echo('</td></tr>');
	}

}

echo('</table>');

?>

</td>
<td>&nbsp;</td>
</tr></table>
</body>
</html>