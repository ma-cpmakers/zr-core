<?php

namespace Zeiras\Core\Tests;

use Orchestra\Testbench\TestCase as Testbench;
use Zeiras\Core\ZrCoreServiceProvider;

/** Un frontend finto: zr-core installato in un'app Laravel. */
abstract class TestCase extends Testbench
{
    protected function getPackageProviders($app): array
    {
        return [ZrCoreServiceProvider::class];
    }
}
