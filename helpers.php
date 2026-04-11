<?php

function asyncStylesheet(string $href): void
{
	echo "<link rel=\"stylesheet\" href=\"" . htmlspecialchars($href) . "\" media=\"print\" onload=\"this.media='all'\">\n";
}
